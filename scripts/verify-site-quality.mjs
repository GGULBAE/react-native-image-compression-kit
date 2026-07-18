#!/usr/bin/env node

import AxeBuilder from '@axe-core/playwright';
import * as chromeLauncher from 'chrome-launcher';
import { existsSync, readFileSync } from 'node:fs';
import lighthouse from 'lighthouse';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'website/.vitepress/dist');
const port = 4173;
const origin = `http://127.0.0.1:${port}`;
const basePath = '/react-native-image-compression-kit/';
const lighthouseRunCount = 3;
const thresholds = {
  performance: 90,
  accessibility: 95,
  seo: 95,
};

if (!existsSync(path.join(dist, 'index.html'))) {
  throw new Error('site build is missing; run pnpm site:build first');
}

const chromePath = findChrome();
if (!chromePath) {
  throw new Error('Chrome or Chromium is required; set CHROME_PATH to its executable');
}

const server = spawn(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'vitepress', 'preview', 'website', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }
);
let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += chunk;
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk;
});

let chrome;
let browser;
try {
  await waitForServer(`${origin}${basePath}`);
  chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const warmupPage = await context.newPage();
  await warmupPage.goto(`${origin}${basePath}`, { waitUntil: 'networkidle' });
  await warmupPage.close();

  const lighthouseRuns = [];
  for (let run = 0; run < lighthouseRunCount; run += 1) {
    const lighthouseResult = await lighthouse(`${origin}${basePath}`, {
      port: chrome.port,
      preset: 'desktop',
      output: 'json',
      logLevel: 'error',
      onlyCategories: Object.keys(thresholds),
    });
    if (!lighthouseResult?.lhr) throw new Error('Lighthouse did not return a report');
    lighthouseRuns.push(
      Object.fromEntries(
        Object.keys(thresholds).map((category) => [
          category,
          Math.round((lighthouseResult.lhr.categories[category]?.score ?? 0) * 100),
        ])
      )
    );
  }

  const scores = Object.fromEntries(
    Object.keys(thresholds).map((category) => [
      category,
      median(lighthouseRuns.map((run) => run[category])),
    ])
  );
  const scoreFailures = Object.entries(thresholds)
    .filter(([category, minimum]) => scores[category] < minimum)
    .map(([category, minimum]) => `${category} ${scores[category]} < ${minimum}`);

  const page = await context.newPage();
  const routes = readSitemapRoutes();
  const violations = [];
  for (const route of routes) {
    await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
    const result = await new AxeBuilder({ page }).analyze();
    for (const violation of result.violations) {
      if (violation.impact === 'critical' || violation.impact === 'serious') {
        violations.push({
          route,
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.length,
          targets: violation.nodes.slice(0, 5).map((node) => node.target.join(' ')),
        });
      }
    }
  }

  const report = {
    schemaVersion: 1,
    status: scoreFailures.length === 0 && violations.length === 0 ? 'passed' : 'failed',
    profile: 'lighthouse-desktop-local-build-median-3',
    scores,
    lighthouseRuns,
    thresholds,
    axe: {
      routes: routes.length,
      seriousOrCriticalViolations: violations,
    },
  };
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (report.status !== 'passed') {
    throw new Error(
      [...scoreFailures, ...violations.map((item) => `${item.route}: ${item.id} (${item.impact})`)].join(
        ' | '
      )
    );
  }
} finally {
  await browser?.close().catch(() => {});
  if (chrome) await Promise.resolve(chrome.kill()).catch(() => {});
  server.kill('SIGTERM');
  if (server.exitCode === null) {
    await Promise.race([
      new Promise((resolve) => server.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
}

function readSitemapRoutes() {
  const sitemap = readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
  const routes = [...sitemap.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map(
    ([, route]) => route
  );
  if (routes.length === 0 || routes.some((route) => !route.startsWith(basePath))) {
    throw new Error('sitemap does not contain canonical site routes');
  }
  return [...new Set(routes)].sort();
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`site preview exited before startup: ${serverOutput}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`site preview did not start: ${serverOutput}`);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}
