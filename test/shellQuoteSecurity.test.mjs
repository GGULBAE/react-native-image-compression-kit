import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = createRequire(path.join(ROOT, 'example', 'package.json'));
const reactNative = createRequire(example.resolve('react-native/package.json'));
const cli = createRequire(
  example.resolve('@react-native-community/cli/package.json')
);
const cliTools = createRequire(
  cli.resolve('@react-native-community/cli-tools/package.json')
);
const consumers = [
  [
    'React DevTools',
    createRequire(reactNative.resolve('react-devtools-core/package.json')),
  ],
  [
    'launch-editor',
    createRequire(cliTools.resolve('launch-editor/package.json')),
  ],
];

describe.each(consumers)('%s shell argument security', (_name, consumer) => {
  const { quote, parse } = consumer('shell-quote');

  it.each(['\n', '\r', '\u2028', '\u2029'])(
    'rejects a line terminator after a comment: %j',
    (terminator) => {
      // Do not execute the generated command. Rejecting it closes the injection path.
      expect(() => quote([
        'printf', 'ok', { comment: 'note' }, `a${terminator}printf injected;#`,
      ])).toThrow(TypeError);
    }
  );

  it('preserves ordinary quoted arguments', () => {
    const args = ['printf', '%s', 'with spaces', "it's literal", '$HOME'];
    expect(parse(quote(args))).toEqual(args);
  });
});
