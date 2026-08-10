import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Pages workflow contract', () => {
  const workflow = readFileSync('.github/workflows/pages.yml', 'utf8');
  const deployJob = workflow.slice(workflow.indexOf('  deploy:'));
  const retryStep = deployJob.slice(
    deployJob.indexOf('      - name: Retry Pages deployment once')
  );

  it('retries one timed-out Pages deployment before failing closed', () => {
    expect(deployJob).toContain('    timeout-minutes: 25');
    expect(
      deployJob.match(/uses: actions\/deploy-pages@[0-9a-f]{40} # v4/g)
    ).toHaveLength(2);
    expect(deployJob).toMatch(
      /id: deployment_primary\n        continue-on-error: true\n        uses: actions\/deploy-pages@[0-9a-f]{40} # v4/
    );
    expect(deployJob).toMatch(
      /id: deployment_retry\n        if: steps\.deployment_primary\.outcome == 'failure'\n        uses: actions\/deploy-pages@[0-9a-f]{40} # v4/
    );
    expect(deployJob).not.toContain('timeout: 1200000');
    expect(deployJob).not.toContain('    timeout-minutes: 10');
    expect(retryStep).not.toContain('continue-on-error');
  });

  it('preserves deployment concurrency, permissions, and environment boundaries', () => {
    expect(workflow).toContain(
      'concurrency:\n  group: pages\n  cancel-in-progress: false'
    );
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(deployJob).toContain('      pages: write\n      id-token: write');
    expect(deployJob).toContain(
      "    environment:\n      name: github-pages\n      url: ${{ steps.deployment_primary.outcome == 'success' && steps.deployment_primary.outputs.page_url || steps.deployment_retry.outputs.page_url }}"
    );
  });
});
