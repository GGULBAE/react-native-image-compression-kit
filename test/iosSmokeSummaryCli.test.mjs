import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

describe('iOS smoke diagnostics summary CLI', () => {
  it('writes the same packed diagnostics summary to stdout and GITHUB_STEP_SUMMARY', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'rnick-ios-smoke-summary-'));

    try {
      const logPath = join(tempDir, 'ios-smoke.log');
      const summaryPath = join(tempDir, 'summary.md');
      const logText = [
        'Installing ImageCompressionKitExample.app',
        'Starting iOS smoke attempt 1/2 with timeout=45000ms.',
        'RNICK_IOS_SMOKE_START',
        'Metro unrelated line',
        'Timed out waiting for RNICK_IOS_SMOKE_PASS after 45000ms.',
        'iOS smoke diagnostics:',
        '- simulator: iPhone Fixture state=Booted',
        '- captured RNICK_IOS_SMOKE stream tail:',
        '  RNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg',
        'iOS smoke log stream error: fixture log stream disconnected',
        'Retrying after terminating the app so the next attempt gets a fresh launch and log stream.',
        'final cleanup line',
      ].join('\n');

      writeFileSync(logPath, logText);

      const result = spawnSync(
        process.execPath,
        ['scripts/ios-validation.mjs', 'summarize-smoke-log', logPath],
        {
          cwd: ROOT,
          encoding: 'utf8',
          env: {
            ...process.env,
            GITHUB_STEP_SUMMARY: summaryPath,
          },
        }
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');

      const summaryFile = readFileSync(summaryPath, 'utf8');
      expect(summaryFile).toBe(result.stdout);
      expect(result.stdout).toContain('## iOS smoke diagnostics');
      expect(result.stdout).toContain('### Key markers and diagnostics');
      expect(result.stdout).toContain('### Packed log tail');
      expect(result.stdout.indexOf('### Key markers and diagnostics')).toBeLessThan(
        result.stdout.indexOf('### Packed log tail')
      );

      const markerSection = result.stdout.slice(
        result.stdout.indexOf('### Key markers and diagnostics'),
        result.stdout.indexOf('### Packed log tail')
      );
      expect(markerSection).toContain('Starting iOS smoke attempt 1/2');
      expect(markerSection).toContain('RNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg');
      expect(markerSection).toContain(
        'iOS smoke log stream error: fixture log stream disconnected'
      );
      expect(markerSection).not.toContain('Installing ImageCompressionKitExample.app');

      const tailSection = result.stdout.slice(result.stdout.indexOf('### Packed log tail'));
      expect(tailSection).toContain('Installing ImageCompressionKitExample.app');
      expect(tailSection).toContain('final cleanup line');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
