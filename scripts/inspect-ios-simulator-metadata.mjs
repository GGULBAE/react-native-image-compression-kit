#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { inspectBootedIosSimulatorMetadata } from './ios-simulator-metadata-core.mjs';

const options = parseArgs(process.argv.slice(2));
for (const field of ['devices', 'runtimes', 'appArchitectures', 'runnerArch']) {
  if (!options[field]) throw new Error(`--${field} is required`);
}
const report = inspectBootedIosSimulatorMetadata({
  devices: JSON.parse(readFileSync(options.devices, 'utf8')),
  runtimes: JSON.parse(readFileSync(options.runtimes, 'utf8')),
  appArchitectures: options.appArchitectures,
  runnerArch: options.runnerArch,
  udid: options.udid ?? null,
});
if (report.status !== 'passed') throw new Error(report.error);
process.stdout.write(`${JSON.stringify(report)}\n`);

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith('--') || !value) {
      throw new Error(`invalid argument: ${flag ?? ''}`);
    }
    parsed[
      flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    ] = value;
  }
  return parsed;
}
