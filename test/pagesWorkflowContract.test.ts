import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Pages workflow contract', () => {
  const workflow = readFileSync('.github/workflows/pages.yml', 'utf8');
  const deployJob = workflow.slice(workflow.indexOf('  deploy:'));

  it('allows the Pages backend to outlive its ten-minute default queue timeout', () => {
    expect(deployJob).toContain('    timeout-minutes: 25');
    expect(deployJob).toMatch(
      /uses: actions\/deploy-pages@[0-9a-f]{40} # v4\n        with:\n(?:          #.*\n)?          timeout: 1200000/
    );
    expect(deployJob).not.toContain('    timeout-minutes: 10');
  });

  it('preserves deployment concurrency, permissions, and environment boundaries', () => {
    expect(workflow).toContain(
      'concurrency:\n  group: pages\n  cancel-in-progress: false'
    );
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(deployJob).toContain('      pages: write\n      id-token: write');
    expect(deployJob).toContain(
      '    environment:\n      name: github-pages\n      url: ${{ steps.deployment.outputs.page_url }}'
    );
  });
});
