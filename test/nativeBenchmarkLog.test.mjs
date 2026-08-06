import { describe, expect, it } from 'vitest';
import {
  createChunkedNativeLogMessages,
  createNativeBenchmarkLogMessages,
  NATIVE_BENCHMARK_LOG_CHUNK_SIZE,
} from '../example/src/nativeBenchmarkLog.ts';
import { parseNativeBenchmarkPayload } from '../scripts/benchmark-core.mjs';

describe('native benchmark log transport', () => {
  it('round-trips payloads through bounded native log messages', () => {
    const payload = {
      schemaVersion: 1,
      samples: Array.from({ length: 10 }, (_, index) => ({
        iteration: index + 1,
        elapsedMs: index + 0.25,
        result: { byteSize: 1_000 + index },
      })),
    };
    const messages = createNativeBenchmarkLogMessages(payload, 'capture-test');

    expect(messages.length).toBeGreaterThan(2);
    expect(
      messages.slice(0, -1).every((message) => {
        const fragment = message.split(/ \d+\/\d+ /, 2)[1];
        return fragment.length <= NATIVE_BENCHMARK_LOG_CHUNK_SIZE;
      })
    ).toBe(true);
    expect(parseNativeBenchmarkPayload(`${messages.join('\n')}\n`)).toEqual(payload);
  });

  it('rejects capture IDs that cannot be parsed unambiguously', () => {
    expect(() => createNativeBenchmarkLogMessages({}, 'Invalid ID')).toThrow(
      'capture ID must be a lowercase identifier'
    );
    expect(() =>
      createChunkedNativeLogMessages({}, 'valid-id', {
        chunk: 'invalid marker',
        pass: 'VALID_PASS',
      })
    ).toThrow('markers must be uppercase identifiers');
  });
});
