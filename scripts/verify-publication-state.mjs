#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  inspectNpmAttestations,
  inspectPublicationState,
} from './release-artifact-core.mjs';

const options = parseArgs(process.argv.slice(2));
const artifact = readJson(options.artifact);
let report;

if (options.attestations) {
  report = inspectNpmAttestations(readJson(options.attestations), {
    packageName: artifact.package,
    version: artifact.version,
  });
} else {
  const registry = readJson(options.registry);
  report = inspectPublicationState({
    expectedVersion: artifact.version,
    artifactIntegrity: artifact.tarballIntegrity,
    registryVersion: registry.exists === false ? null : registry.version,
    registryIntegrity: registry.exists === false ? null : registry.integrity,
  });
}

const output = `${JSON.stringify(report)}\n`;
if (options.reportFile) writeFileSync(path.resolve(options.reportFile), output);
process.stdout.write(output);
if (report.status !== 'passed') process.exit(1);

function parseArgs(args) {
  const parsed = {};
  const fields = {
    '--artifact': 'artifact',
    '--registry': 'registry',
    '--attestations': 'attestations',
    '--report-file': 'reportFile',
  };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--') continue;
    const field = fields[args[index]];
    if (!field) throw new Error(`unknown publication-state argument: ${args[index]}`);
    parsed[field] = args[++index];
  }
  if (!parsed.artifact || (!parsed.registry && !parsed.attestations)) {
    throw new Error('publication state requires --artifact and --registry or --attestations');
  }
  return parsed;
}

function readJson(file) {
  return JSON.parse(readFileSync(path.resolve(file), 'utf8'));
}
