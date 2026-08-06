import { describe, expect, it } from 'vitest';
import {
  inspectGuidedDemoPayload,
  parseGuidedDemoPayload,
} from '../scripts/guided-demo-core.mjs';

const options = {
  resize: { maxWidth: 160, maxHeight: 160, mode: 'contain' },
  output: { format: 'jpeg', quality: 76, maxBytes: 8_000 },
  metadata: 'safe',
};
const result = {
  format: 'jpeg',
  width: 100,
  height: 160,
  byteSize: 2_264,
  originalByteSize: 13_543,
  compressionRatio: 2_264 / 13_543,
};

describe('guided native demo contract', () => {
  it('parses and accepts the ordered 22-second walkthrough', () => {
    const payload = validPayload();
    const log = `prefix\nRNICK_GUIDED_DEMO_PASS ${JSON.stringify(payload)}\n`;
    expect(parseGuidedDemoPayload(log)).toEqual(payload);
    expect(
      inspectGuidedDemoPayload(payload, {
        platform: 'android',
        options,
        result,
      })
    ).toEqual({ status: 'passed', error: null });
  });

  it('rejects missing and malformed pass markers', () => {
    expect(() => parseGuidedDemoPayload('no marker')).toThrow(
      'RNICK_GUIDED_DEMO_PASS payload is missing'
    );
    expect(() => parseGuidedDemoPayload('RNICK_GUIDED_DEMO_PASS {bad}')).toThrow(
      'RNICK_GUIDED_DEMO_PASS payload is invalid'
    );
  });

  it('rejects early transitions, short result hold, and request drift', () => {
    const payload = validPayload();
    payload.stages[0].elapsedMs = 2_001;
    payload.stages[1].elapsedMs = 2_500;
    payload.durationMs = 19_000;
    payload.stages[4].elapsedMs = 13_000;
    payload.options.output.quality = 20;
    payload.platform = 'ios';
    const report = inspectGuidedDemoPayload(payload, {
      platform: 'android',
      options,
      result,
    });
    expect(report.status).toBe('failed');
    expect(report.error).toContain('platform does not match');
    expect(report.error).toContain('source stage started too late');
    expect(report.error).toContain('options advanced too early');
    expect(report.error).toContain('result stage was not held long enough');
    expect(report.error).toContain('options do not match');
  });

  it('rejects malformed stage collections and status metadata', () => {
    const payload = validPayload();
    payload.schemaVersion = 2;
    payload.status = 'failed';
    payload.platform = 'web';
    payload.stages = [{ id: 'source', ordinal: 0, elapsedMs: -1 }];
    payload.durationMs = '22 seconds';
    const report = inspectGuidedDemoPayload(payload);
    expect(report.status).toBe('failed');
    expect(report.error).toContain('schemaVersion must be 1');
    expect(report.error).toContain('status must be passed');
    expect(report.error).toContain('platform must be android or ios');
    expect(report.error).toContain('exactly five stages');
    expect(report.error).toContain('elapsedMs values must be non-negative integers');
    expect(report.error).toContain('duration must be between 18 and 30 seconds');
  });
});

function validPayload() {
  return {
    schemaVersion: 1,
    platform: 'android',
    status: 'passed',
    stages: [
      { id: 'source', ordinal: 0, elapsedMs: 0 },
      { id: 'options', ordinal: 1, elapsedMs: 5_000 },
      { id: 'capabilities', ordinal: 2, elapsedMs: 9_000 },
      { id: 'compressing', ordinal: 3, elapsedMs: 13_000 },
      { id: 'result', ordinal: 4, elapsedMs: 15_000 },
    ],
    durationMs: 22_000,
    options: structuredClone(options),
    result: structuredClone(result),
  };
}
