import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resolveImageSizePackage() {
  let packageRequire = createRequire(path.join(ROOT, 'example', 'package.json'));
  for (const packageName of [
    'react-native',
    '@react-native/community-cli-plugin',
    'metro',
    'image-size',
  ]) {
    const packageJsonPath = packageRequire.resolve(packageName + '/package.json');
    packageRequire = createRequire(packageJsonPath);
  }
  return path.dirname(packageRequire.resolve('image-size/package.json'));
}

describe('patched image-size parser', () => {
  it('rejects zero-length ICNS entries and advances past zero-size boxes', () => {
    const packageRoot = resolveImageSizePackage();
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `
          const imageSize = require(${JSON.stringify(
            path.join(packageRoot, 'dist', 'index.js')
          )});
          const { findBox } = require(${JSON.stringify(
            path.join(packageRoot, 'dist', 'types', 'utils.js')
          )});

          function createIcns(lengths) {
            const input = Buffer.alloc(8 + lengths.length * 8);
            input.write('icns', 0, 'ascii');
            input.writeUInt32BE(input.length, 4);
            lengths.forEach((length, index) => {
              const offset = 8 + index * 8;
              input.write('ic07', offset, 'ascii');
              input.writeUInt32BE(length, offset + 4);
            });
            return input;
          }

          const errors = [[0], [8, 0]].map((lengths) => {
            try {
              imageSize(createIcns(lengths));
              return null;
            } catch (error) {
              return error.message;
            }
          });
          const valid = imageSize(createIcns([8]));

          const zeroSizeBox = Buffer.alloc(8);
          zeroSizeBox.write('free', 4, 'ascii');
          const missingBox = findBox(zeroSizeBox, 'meta', 0);
          process.stdout.write(JSON.stringify({ errors, valid, missingBox }));
        `,
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 1_000,
      }
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      errors: [
        'Invalid ICNS image entry length',
        'Invalid ICNS image entry length',
      ],
      valid: {
        height: 128,
        type: 'ic07',
        width: 128,
      },
    });
  });
});
