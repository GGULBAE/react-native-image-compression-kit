#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalDependencySecurityReport,
  readDependencySecurityInputs,
  verifyDependencySecurity,
} from './dependency-security-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseDependencySecurityArgs(argv) {
  const options = { rootDir: ROOT, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') {
      options.json = true;
      continue;
    }
    if (argument === '--root') {
      const value = argv[index + 1];
      if (!value) throw new Error('--root requires a path.');
      options.rootDir = path.resolve(value);
      index += 1;
      continue;
    }
    if (argument === '--') continue;
    throw new Error('Unknown argument: ' + argument);
  }
  return options;
}

export function runDependencySecurityVerification(options) {
  return verifyDependencySecurity(
    readDependencySecurityInputs(options.rootDir)
  );
}

function main() {
  let options;
  let report;
  try {
    options = parseDependencySecurityArgs(process.argv.slice(2));
    report = runDependencySecurityVerification(options);
  } catch (error) {
    console.error(
      'Dependency security verification failed: ' +
        (error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }

  if (options.json) {
    process.stdout.write(canonicalDependencySecurityReport(report));
  } else if (report.status === 'passed') {
    console.log(
      'Dependency security verification passed: Vite ' +
        report.viteVersions.join(', ') +
        ', esbuild ' +
        report.esbuildVersions.join(', ') +
        ', @opentelemetry/core ' +
        report.opentelemetryCoreVersions.join(', ') +
        ', shell-quote ' +
        report.shellQuoteVersions.join(', ') +
        ', production exposure none.'
    );
  } else {
    console.error('Dependency security verification failed: ' + report.error);
  }

  if (report.status !== 'passed') process.exitCode = 1;
}

const entryPoint = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPoint === fileURLToPath(import.meta.url)) main();
