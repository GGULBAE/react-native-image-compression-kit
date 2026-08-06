export const NATIVE_BENCHMARK_ID = 'jpeg-resize-q80';
export const NATIVE_BENCHMARK_WARMUP_ITERATIONS = 2;
export const NATIVE_BENCHMARK_MEASURED_ITERATIONS = 10;
export const NATIVE_BENCHMARK_OPERATION = {
  resize: { maxWidth: 320, maxHeight: 320, mode: 'contain' },
  output: { format: 'jpeg', quality: 80 },
  metadata: 'strip',
} as const;
