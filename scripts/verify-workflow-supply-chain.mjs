#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WORKFLOW_ACTION_LOCK_FILE,
  WORKFLOW_DEPENDABOT_FILE,
  canonicalWorkflowSupplyChainReport,
  createWorkflowSupplyChainReport,
  verifyWorkflowSupplyChain,
  writeWorkflowSupplyChainReportAtomic,
} from './workflow-supply-chain-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export function parseWorkflowSupplyChainArgs(args) {
  const parsed = {};
  const valueFlags = {
    '--root': 'rootDir',
    '--workflow-dir': 'workflowDir',
    '--lock-file': 'lockFile',
    '--dependabot-file': 'dependabotFile',
    '--report-file': 'reportFile',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (valueFlags[arg]) {
      parsed[valueFlags[arg]] = readValue(args, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function main() {
  let options = {};
  let report;

  try {
    options = parseWorkflowSupplyChainArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    const rootDir = path.resolve(options.rootDir ?? ROOT);
    report = verifyWorkflowSupplyChain({
      rootDir,
      workflowDir: options.workflowDir
        ? path.resolve(options.workflowDir)
        : path.join(rootDir, '.github', 'workflows'),
      lockFile: options.lockFile
        ? path.resolve(options.lockFile)
        : path.join(rootDir, WORKFLOW_ACTION_LOCK_FILE),
      dependabotFile: options.dependabotFile
        ? path.resolve(options.dependabotFile)
        : path.join(rootDir, WORKFLOW_DEPENDABOT_FILE),
    });
  } catch (error) {
    report = createWorkflowSupplyChainReport({
      lockFile: options.lockFile ? path.resolve(options.lockFile) : null,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (options.reportFile) {
    try {
      writeWorkflowSupplyChainReportAtomic(options.reportFile, report);
    } catch (error) {
      report = createWorkflowSupplyChainReport({
        lockFile: report.lockFile,
        workflowCount: report.workflowCount,
        actionCount: report.actionCount,
        usageCount: report.usageCount,
        lockSha256: report.lockSha256,
        checks: report.checks,
        error: `Could not write workflow supply-chain report atomically: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  const canonical = canonicalWorkflowSupplyChainReport(report);
  if (options.json || report.status === 'passed') {
    process.stdout.write(canonical);
  } else {
    process.stderr.write(`${report.error}\n`);
    process.stdout.write(canonical);
  }
  if (report.status !== 'passed') process.exitCode = 1;
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function usage() {
  return `Usage: pnpm verify:workflow-supply-chain -- --json\n\nOptions:\n  --root <path>              Repository root; defaults to the current project.\n  --workflow-dir <path>      Workflow directory; defaults to .github/workflows.\n  --lock-file <path>         Canonical Action lock; defaults to .github/actions-lock.json.\n  --dependabot-file <path>   Dependabot config; defaults to .github/dependabot.yml.\n  --json                     Emit exactly one canonical JSON object to stdout.\n  --report-file <path>       Atomically write the same verification report.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) main();
