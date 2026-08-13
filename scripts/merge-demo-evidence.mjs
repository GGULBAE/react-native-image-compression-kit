#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { inspectDemoVisualAgreement } from './demo-visual-agreement-core.mjs';

const args = parseArgs(process.argv.slice(2));
for (const field of [
  'androidDir',
  'iosDir',
  'destination',
]) {
  if (!args[field]) throw new Error(`--${field.replace(/[A-Z]/g, (x) => `-${x.toLowerCase()}`)} is required`);
}
const destination = path.resolve(args.destination);
if (existsSync(destination)) {
  throw new Error(`destination already exists: ${destination}`);
}
const fragments = [];
for (const [platform, sourceDir] of [
  ['android', args.androidDir],
  ['ios', args.iosDir],
]) {
  const source = path.resolve(sourceDir);
  const evidence = JSON.parse(readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  if (
    evidence.schemaVersion !== 3 ||
    evidence.platform !== platform ||
    evidence.status !== 'passed'
  ) {
    throw new Error(`${platform} evidence fragment is invalid`);
  }
  const sourceAsset = evidence.assets?.source;
  const outputAsset = evidence.assets?.output;
  const assetNames = Object.keys(evidence.assets ?? {}).sort();
  if (
    JSON.stringify(assetNames) !==
    JSON.stringify(['output', 'recording', 'screenshot', 'source'])
  ) {
    throw new Error(`${platform} evidence must contain exactly four declared assets`);
  }
  for (const name of ['source', 'output', 'screenshot', 'recording']) {
    inspectAsset(source, name, evidence.assets?.[name]);
  }
  const visual = inspectDemoVisualAgreement(evidence.visualAgreement, {
    sourceBytes: readFileSync(resolveAsset(source, 'source', sourceAsset)),
    outputBytes: readFileSync(resolveAsset(source, 'output', outputAsset)),
    resizeOptions: evidence.options?.resize,
  });
  if (
    evidence.visualAgreement?.schemaVersion !== 2 ||
    visual.status !== 'passed' ||
    visual.agreementStatus !== 'passed'
  ) {
    throw new Error(
      `${platform} evidence visual agreement is invalid: ${visual.error ?? `outcome ${visual.agreementStatus}`}`
    );
  }
  if (
    evidence.visualAgreement.width !== evidence.result?.width ||
    evidence.visualAgreement.height !== evidence.result?.height
  ) {
    throw new Error(`${platform} evidence visual dimensions do not match the native result`);
  }
  fragments.push({ platform, source, evidence });
}
if (new Set(fragments.map(({ evidence }) => evidence.packageVersion)).size !== 1) {
  throw new Error('demo fragments have different package versions');
}
if (new Set(fragments.map(({ evidence }) => evidence.sourceCommit)).size !== 1) {
  throw new Error('demo fragments have different source commits');
}

const cases = [];
for (const { platform, source, evidence } of fragments) {
  const platformDestination = path.join(destination, platform);
  mkdirSync(platformDestination, { recursive: true });
  const assets = {};
  for (const [name, asset] of Object.entries(evidence.assets)) {
    cpSync(path.join(source, asset.file), path.join(platformDestination, asset.file));
    assets[name] = { ...asset, file: `${platform}/${asset.file}` };
  }
  cases.push({ ...evidence, assets });
}
const manifest = {
  schemaVersion: 3,
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

function inspectAsset(root, name, asset) {
  const file = resolveAsset(root, name, asset);
  if (!lstatSync(file).isFile()) {
    throw new Error(`${name} asset must be a regular file`);
  }
  const bytes = readFileSync(file);
  if (statSync(file).size !== asset.byteSize) {
    throw new Error(`${name} asset byte size mismatch`);
  }
  if (sha256(bytes) !== asset.sha256) {
    throw new Error(`${name} asset SHA-256 mismatch`);
  }
}

function resolveAsset(root, name, asset) {
  if (
    typeof asset?.file !== 'string' ||
    asset.file.startsWith('/') ||
    asset.file.includes('..')
  ) {
    throw new Error(`${name} asset path is invalid`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, asset.file);
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`) || !existsSync(resolved)) {
    throw new Error(`${name} asset is missing`);
  }
  return resolved;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
