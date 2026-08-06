import type {
  CompressionOptions,
  CompressionResult,
  ImageCompressionCapabilities,
} from 'react-native-image-compression-kit';
import type { ExampleImageSourceModule } from './exampleNative';
import {
  completeNativeDemoCapture,
  prepareNativeDemoCapture,
  type DemoCapture,
} from './demoCapture';

export const GUIDED_DEMO_STAGES = [
  { id: 'source', label: 'Source' },
  { id: 'options', label: 'Options' },
  { id: 'capabilities', label: 'Capability' },
  { id: 'compressing', label: 'Compress' },
  { id: 'result', label: 'Result' },
] as const;

export type GuidedDemoStage = (typeof GUIDED_DEMO_STAGES)[number]['id'];

export type GuidedDemoState = {
  stage: GuidedDemoStage;
  sourceUri: string;
  capabilities: ImageCompressionCapabilities;
  options: CompressionOptions;
  result: CompressionResult | null;
};

type GuidedDemoEvent = {
  id: GuidedDemoStage;
  ordinal: number;
  elapsedMs: number;
};

type GuidedDemoCallbacks = {
  onState: (state: GuidedDemoState) => void;
  emitLog: (message: string) => Promise<void>;
  wait?: (durationMs: number) => Promise<void>;
  now?: () => number;
};

export type GuidedDemoCapture = DemoCapture & {
  guidedLog: string;
};

const SOURCE_STAGE_MS = 5_000;
const SOURCE_READY_DELAY_MS = 750;
const OPTIONS_STAGE_MS = 4_000;
const CAPABILITIES_STAGE_MS = 4_000;
const COMPRESSING_STAGE_MS = 2_000;
const RESULT_STAGE_MS = 7_000;

export async function runGuidedNativeDemo(
  sampleModule: ExampleImageSourceModule,
  platform: 'android' | 'ios',
  callbacks: GuidedDemoCallbacks
): Promise<GuidedDemoCapture> {
  const wait = callbacks.wait ?? defaultWait;
  const now = callbacks.now ?? Date.now;
  const prepared = await prepareNativeDemoCapture(sampleModule);
  const events: GuidedDemoEvent[] = [];
  const startedAt = now();
  let result: CompressionResult | null = null;

  const enterStage = async (stage: GuidedDemoStage) => {
    const ordinal = GUIDED_DEMO_STAGES.findIndex(({ id }) => id === stage);
    const event = { id: stage, ordinal, elapsedMs: now() - startedAt };
    events.push(event);
    callbacks.onState({
      stage,
      sourceUri: prepared.sourceUri,
      capabilities: prepared.capabilities,
      options: prepared.options,
      result,
    });
    await callbacks.emitLog(
      `RNICK_GUIDED_DEMO_STAGE ${JSON.stringify({
        schemaVersion: 1,
        platform,
        ...event,
      })}`
    );
  };

  await enterStage('source');
  await wait(SOURCE_READY_DELAY_MS);
  await callbacks.emitLog(
    `RNICK_GUIDED_DEMO_READY ${JSON.stringify({ schemaVersion: 1, platform })}`
  );
  await wait(SOURCE_STAGE_MS - SOURCE_READY_DELAY_MS);

  await enterStage('options');
  await wait(OPTIONS_STAGE_MS);

  await enterStage('capabilities');
  await wait(CAPABILITIES_STAGE_MS);

  await enterStage('compressing');
  await wait(COMPRESSING_STAGE_MS);

  const capture = await completeNativeDemoCapture(prepared, platform);
  result = capture.result;
  await enterStage('result');
  await wait(RESULT_STAGE_MS);

  const guidedPayload = {
    schemaVersion: 1,
    platform,
    status: 'passed',
    stages: events,
    durationMs: now() - startedAt,
    options: {
      resize: prepared.options.resize,
      output: prepared.options.output,
      metadata: prepared.options.metadata,
    },
    result: {
      format: capture.result.format,
      width: capture.result.width,
      height: capture.result.height,
      byteSize: capture.result.byteSize,
      originalByteSize: capture.result.originalByteSize,
      compressionRatio: capture.result.compressionRatio,
    },
  };

  return {
    ...capture,
    guidedLog: `RNICK_GUIDED_DEMO_PASS ${JSON.stringify(guidedPayload)}`,
  };
}

function defaultWait(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
