#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
for (const field of ['androidDir', 'iosDir', 'destination']) {
  if (!args[field]) throw new Error(`--${field.replace(/[A-Z]/g, (x) => `-${x.toLowerCase()}`)} is required`);
}
const destination = path.resolve(args.destination);
if (existsSync(destination)) {
  throw new Error(`destination already exists: ${destination}`);
}
const cases = [];
for (const [platform, sourceDir] of [
  ['android', args.androidDir],
  ['ios', args.iosDir],
]) {
  const source = path.resolve(sourceDir);
  const evidence = JSON.parse(readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  if (evidence.platform !== platform || evidence.status !== 'passed') {
    throw new Error(`${platform} evidence fragment is invalid`);
  }
  const platformDestination = path.join(destination, platform);
  mkdirSync(platformDestination, { recursive: true });
  const assets = {};
  for (const [name, asset] of Object.entries(evidence.assets)) {
    cpSync(path.join(source, asset.file), path.join(platformDestination, asset.file));
    assets[name] = { ...asset, file: `${platform}/${asset.file}` };
  }
  cases.push({ ...evidence, assets });
}
if (new Set(cases.map(({ packageVersion }) => packageVersion)).size !== 1) {
  throw new Error('demo fragments have different package versions');
}
if (new Set(cases.map(({ sourceCommit }) => sourceCommit)).size !== 1) {
  throw new Error('demo fragments have different source commits');
}
const manifest = {
  schemaVersion: 1,
  status: 'passed',
  packageVersion: cases[0].packageVersion,
  sourceCommit: cases[0].sourceCommit,
  cases,
};
writeFileSync(path.join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(manifest)}\n`);

function parseArgs(values) {
  const parsed = {};
  const normalizedValues = values.filter((value) => value !== '--');
  for (let index = 0; index < normalizedValues.length; index += 2) {
    const flag = normalizedValues[index];
    const value = normalizedValues[index + 1];
    if (!flag?.startsWith('--') || !value) throw new Error(`invalid argument: ${flag ?? ''}`);
    parsed[flag.slice(2).replace(/-([a-z])/g, (_, x) => x.toUpperCase())] = value;
  }
  return parsed;
}
