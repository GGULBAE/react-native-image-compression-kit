import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, '..');
const WORKFLOW_DIR = path.join(ROOT, '.github', 'workflows');

function literalRunBlocks(source) {
  const lines = source.split('\n');
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*(?:-\s+)?run:\s*\|[-+]?\s*$/);
    if (!match) continue;

    const keyIndent = lines[index].indexOf('run:');
    const body = [];
    let blockIndent = null;
    let cursor = index + 1;
    for (; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      const trimmed = line.trim();
      const indent = line.length - line.trimStart().length;
      if (trimmed && indent <= keyIndent) break;
      if (trimmed && blockIndent == null) blockIndent = indent;
      if (blockIndent != null) {
        body.push(trimmed ? line.slice(blockIndent) : '');
      }
    }

    if (body.length > 0) blocks.push(body.join('\n'));
    index = cursor - 1;
  }

  return blocks;
}

function bashSyntax(block) {
  return spawnSync('bash', ['-n'], {
    input: block,
    encoding: 'utf8',
  });
}

describe('GitHub Actions shell syntax', () => {
  it('parses every literal workflow run block with bash', () => {
    const workflows = readdirSync(WORKFLOW_DIR)
      .filter((entry) => /\.ya?ml$/.test(entry))
      .sort();

    for (const workflow of workflows) {
      const source = readFileSync(path.join(WORKFLOW_DIR, workflow), 'utf8');
      for (const [index, block] of literalRunBlocks(source).entries()) {
        const result = bashSyntax(block);
        const context = `${workflow} run block ${index + 1}: ${result.stderr}`;
        expect(result.status, context).toBe(0);
        expect(result.stderr, context).toBe('');
      }
    }
  });

  it('rejects an indented heredoc terminator inside a conditional', () => {
    const [block] = literalRunBlocks(`steps:\n  - name: Broken heredoc\n    run: |\n      if true; then\n        node <<'NODE'\n        console.log('broken');\n        NODE\n      fi\n`);

    expect(bashSyntax(block).stderr).not.toBe('');
  });
});
