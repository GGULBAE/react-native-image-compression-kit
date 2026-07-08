import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import {
  createIOSValidationConfig,
  createSmokeAttemptLifecycle,
  createSmokeTimeoutErrorFromCLIState,
} from '../scripts/ios-smoke-contract.mjs';

function createFakeProcess() {
  return Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
  });
}

function createFixture() {
  const metroProcess = createFakeProcess();
  const logProcess = createFakeProcess();
  const setLogProcessCalls = [];
  const stopProcessCalls = [];
  const output = [];
  const passCallbacks = [];
  const failCallbacks = [];
  let timeoutClearCount = 0;

  const lifecycle = createSmokeAttemptLifecycle({
    metroProcess,
    logProcess,
    setLogProcess(value) {
      setLogProcessCalls.push(value);
    },
    stopProcess(value) {
      stopProcessCalls.push(value);
    },
    clearAttemptTimeout() {
      timeoutClearCount += 1;
    },
    writeOutput(text) {
      output.push(text);
    },
    onPass() {
      passCallbacks.push('pass');
    },
    onFail(error) {
      failCallbacks.push(error);
    },
  });

  lifecycle.attach();

  return {
    failCallbacks,
    getTimeoutClearCount: () => timeoutClearCount,
    lifecycle,
    logProcess,
    metroProcess,
    output,
    passCallbacks,
    setLogProcessCalls,
    stopProcessCalls,
  };
}

function expectAttached({
  logProcess,
  metroProcess,
  setLogProcessCalls,
  stopProcessCalls,
}) {
  expect(metroProcess.stdout.listenerCount('data')).toBe(1);
  expect(metroProcess.stderr.listenerCount('data')).toBe(1);
  expect(logProcess.stdout.listenerCount('data')).toBe(1);
  expect(logProcess.stderr.listenerCount('data')).toBe(1);
  expect(logProcess.listenerCount('error')).toBe(1);
  expect(setLogProcessCalls).toEqual([logProcess]);
  expect(stopProcessCalls).toEqual([]);
}

function expectCleaned({
  getTimeoutClearCount,
  logProcess,
  metroProcess,
  setLogProcessCalls,
  stopProcessCalls,
}) {
  expect(metroProcess.stdout.listenerCount('data')).toBe(0);
  expect(metroProcess.stderr.listenerCount('data')).toBe(0);
  expect(logProcess.stdout.listenerCount('data')).toBe(0);
  expect(logProcess.stderr.listenerCount('data')).toBe(0);
  expect(logProcess.listenerCount('error')).toBe(0);
  expect(stopProcessCalls).toEqual([logProcess]);
  expect(setLogProcessCalls).toEqual([logProcess, null]);
  expect(getTimeoutClearCount()).toBe(1);
}

describe('iOS smoke process lifecycle helpers', () => {
  it('removes listeners, stops the log process, and clears the reference after PASS settle', () => {
    const fixture = createFixture();
    expectAttached(fixture);

    fixture.logProcess.stdout.emit('data', Buffer.from('RNICK_IOS_SMOKE_PASS\n'));

    expect(fixture.passCallbacks).toEqual(['pass']);
    expect(fixture.failCallbacks).toEqual([]);
    expect(fixture.output).toEqual(['RNICK_IOS_SMOKE_PASS\n']);
    expectCleaned(fixture);

    fixture.logProcess.stdout.emit('data', Buffer.from('RNICK_IOS_SMOKE_FAIL\n'));
    expect(fixture.passCallbacks).toEqual(['pass']);
    expect(fixture.failCallbacks).toEqual([]);
  });

  it('removes listeners, stops the log process, and clears the reference after FAIL settle', () => {
    const fixture = createFixture();
    expectAttached(fixture);

    fixture.metroProcess.stderr.emit('data', Buffer.from('RNICK_IOS_SMOKE_FAIL fixture\n'));

    expect(fixture.passCallbacks).toEqual([]);
    expect(fixture.failCallbacks).toHaveLength(1);
    expect(fixture.failCallbacks[0].message).toBe(
      'iOS smoke failed:\nRNICK_IOS_SMOKE_FAIL fixture\n'
    );
    expectCleaned(fixture);

    fixture.logProcess.stdout.emit('data', Buffer.from('RNICK_IOS_SMOKE_PASS\n'));
    expect(fixture.passCallbacks).toEqual([]);
    expect(fixture.failCallbacks).toHaveLength(1);
  });

  it('removes listeners, stops the log process, and clears the reference after timeout settle', () => {
    const fixture = createFixture();
    expectAttached(fixture);

    fixture.logProcess.stdout.emit(
      'data',
      Buffer.from('RNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg\n')
    );
    fixture.lifecycle.setLaunchOutput('com.imagecompressionkit.example: 4242');

    expect(fixture.lifecycle.snapshot()).toMatchObject({
      launchOutput: 'com.imagecompressionkit.example: 4242',
      markerBuffer: 'RNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg\n',
      settled: false,
      smokeLogOutput: 'RNICK_IOS_SMOKE_STEP_START compress-jpeg-to-jpeg\n',
    });

    const timeoutError = new Error('Timed out waiting for RNICK_IOS_SMOKE_PASS after 1ms.');
    timeoutError.rnickSmokeTimeout = true;

    fixture.lifecycle.finish((error) => fixture.failCallbacks.push(error), timeoutError);

    expect(fixture.passCallbacks).toEqual([]);
    expect(fixture.failCallbacks).toEqual([timeoutError]);
    expect(fixture.lifecycle.snapshot().settled).toBe(true);
    expectCleaned(fixture);

    fixture.logProcess.stdout.emit('data', Buffer.from('RNICK_IOS_SMOKE_PASS\n'));
    expect(fixture.passCallbacks).toEqual([]);
    expect(fixture.failCallbacks).toEqual([timeoutError]);
  });

  it('records log stream errors in output, snapshot state, and timeout diagnostics', () => {
    const fixture = createFixture();
    expectAttached(fixture);

    fixture.logProcess.emit('error', new Error('fixture log stream disconnected'));

    const logStreamErrorOutput =
      'iOS smoke log stream error: fixture log stream disconnected\n';
    expect(fixture.output).toEqual([logStreamErrorOutput]);
    expect(fixture.lifecycle.snapshot()).toMatchObject({
      markerBuffer: logStreamErrorOutput,
      settled: false,
      smokeLogOutput: logStreamErrorOutput,
    });
    expect(fixture.passCallbacks).toEqual([]);
    expect(fixture.failCallbacks).toEqual([]);

    fixture.lifecycle.setLaunchOutput('com.imagecompressionkit.example: 4242');
    const { launchOutput, smokeLogOutput } = fixture.lifecycle.snapshot();
    const timeoutError = createSmokeTimeoutErrorFromCLIState({
      config: createIOSValidationConfig({
        RNICK_IOS_SMOKE_ATTEMPTS: '1',
        RNICK_IOS_SMOKE_TIMEOUT_MS: '1',
      }),
      attempt: 1,
      udid: 'SIM-ERROR',
      bundleId: 'com.imagecompressionkit.example',
      scheme: 'ImageCompressionKitExample',
      smokeLogOutput,
      launchOutput,
      metroOutput: 'Metro ready',
      simulatorSummary(udid) {
        return `iPhone Fixture (${udid}) state=Booted`;
      },
      optionalCommandOutput(command, args) {
        return `${command} ${args.join(' ')} fixture output`;
      },
      recentIOSSmokeLogs() {
        return '(no matching unified log entries captured)';
      },
    });

    expect(timeoutError.message).toContain('- captured RNICK_IOS_SMOKE stream tail:');
    expect(timeoutError.message).toContain(logStreamErrorOutput.trim());

    fixture.lifecycle.finish((error) => fixture.failCallbacks.push(error), timeoutError);

    expect(fixture.passCallbacks).toEqual([]);
    expect(fixture.failCallbacks).toEqual([timeoutError]);
    expect(fixture.lifecycle.snapshot().settled).toBe(true);
    expectCleaned(fixture);
  });
});
