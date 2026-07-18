#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHeadings, parseMarkdownLinks } from './docs-semantic-core.mjs';
import { inspectDemoEvidence } from './demo-evidence-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const websiteRoot = path.join(root, 'website');
const canonicalSite = 'https://ggulbae.github.io/react-native-image-compression-kit/';
const requiredFiles = [
  'website/.vitepress/config.mts',
  'website/.vitepress/theme/index.ts',
  'website/.vitepress/theme/OptionBuilder.vue',
  'website/.vitepress/theme/custom.css',
  'website/public/logo.svg',
  'website/public/social-card.svg',
  'website/index.md',
  'website/404.md',
  'website/guide/installation.md',
  'website/guide/integration.md',
  'website/guide/recipes.md',
  'website/guide/capabilities.md',
  'website/guide/files-metadata.md',
  'website/guide/errors.md',
  'website/guide/testing.md',
  'website/reference/api.md',
  'website/reference/compatibility.md',
  'website/demo/index.md',
  'website/changelog.md',
  'test/publicApiExamples.ts',
];

const errors = [];
for (const relativePath of requiredFiles) {
  if (!existsSync(path.join(root, relativePath))) {
    errors.push(`missing site file: ${relativePath}`);
  }
}

const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const releaseStatus = JSON.parse(
  readFileSync(path.join(root, 'docs', 'release-status.json'), 'utf8')
);
if (packageJson.homepage !== canonicalSite) {
  errors.push(`package homepage expected ${canonicalSite}, received ${packageJson.homepage}`);
}
for (const entry of packageJson.files ?? []) {
  if (entry === 'website' || entry.startsWith('website/')) {
    errors.push(`npm package must exclude website source: ${entry}`);
  }
}

const markdownFiles = collectFiles(websiteRoot, (file) => file.endsWith('.md'));
for (const sourcePath of markdownFiles) {
  const source = readFileSync(sourcePath, 'utf8');
  const relativeSource = path.relative(root, sourcePath);
  const headings = parseHeadings(source);
  if (headings.length === 0 && !source.includes('layout: home')) {
    errors.push(`${relativeSource}: expected a Markdown heading or home layout`);
  }
  for (const { target } of parseMarkdownLinks(source)) {
    if (/^(https?:|mailto:)/.test(target) || target.startsWith('#')) {
      continue;
    }
    const [rawPath, rawAnchor = ''] = target.split('#', 2);
    const targetPath = resolveMarkdownTarget(sourcePath, rawPath);
    if (!targetPath || !existsSync(targetPath) || statSync(targetPath).isDirectory()) {
      errors.push(`${relativeSource}: missing local link target ${target}`);
      continue;
    }
    if (rawAnchor) {
      const anchors = new Set(
        parseHeadings(readFileSync(targetPath, 'utf8')).map(({ anchor }) => anchor)
      );
      if (!anchors.has(decodeURIComponent(rawAnchor).toLowerCase())) {
        errors.push(`${relativeSource}: missing anchor ${target}`);
      }
    }
  }
}

const combined = markdownFiles
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');
for (const requiredText of [
  'npm install react-native-image-compression-kit',
  'Expo Go',
  'development build',
  'Android 23',
  'iOS 13.4',
  'ImageCompressionKitErrorCode',
  'compressionRatio',
  'cache file',
  'SHA-256',
]) {
  if (!combined.includes(requiredText)) {
    errors.push(`site missing semantic contract: ${requiredText}`);
  }
}

for (const forbiddenClaim of [
  'fastest image compressor',
  'compresses images in your browser',
  'Expo Go is supported',
]) {
  if (combined.toLowerCase().includes(forbiddenClaim.toLowerCase())) {
    errors.push(`site contains unsupported claim: ${forbiddenClaim}`);
  }
}

const demoManifestPath = path.join(websiteRoot, 'public', 'demo', 'manifest.json');
if (existsSync(demoManifestPath)) {
  const report = inspectDemoEvidence(
    path.dirname(demoManifestPath),
    JSON.parse(readFileSync(demoManifestPath, 'utf8'))
  );
  if (report.status !== 'passed') errors.push(`native demo evidence: ${report.error}`);
  if (report.packageVersion !== packageJson.version) {
    errors.push('native demo evidence package version does not match package.json');
  }
} else if (releaseStatus.releaseState === 'release') {
  errors.push('release state requires passed Android and iOS native demo evidence');
}

if (errors.length > 0) {
  console.error(`Site verification failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `Site verification passed: ${markdownFiles.length} Markdown pages, canonical homepage, internal links, public contracts, and npm exclusion.`
);

function collectFiles(directory, predicate) {
  const files = [];
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, predicate));
    } else if (entry.isFile() && predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function resolveMarkdownTarget(sourcePath, target) {
  if (!target) return sourcePath;
  if (target.startsWith('/')) {
    const clean = target.replace(/^\//, '').replace(/\/$/, '/index');
    return path.join(websiteRoot, clean.endsWith('.md') ? clean : `${clean}.md`);
  }
  return path.resolve(path.dirname(sourcePath), decodeURIComponent(target));
}
