export const NATIVE_BENCHMARK_CHUNK_MARKER = 'RNICK_BENCHMARK_CHUNK';
export const NATIVE_BENCHMARK_PASS_MARKER = 'RNICK_BENCHMARK_PASS';
export const NATIVE_BENCHMARK_LOG_CHUNK_SIZE = 480;

export function createNativeBenchmarkLogMessages(
  payload: unknown,
  captureId: string
): string[] {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(captureId)) {
    throw new Error('Native benchmark capture ID must be a lowercase identifier.');
  }

  const serialized = JSON.stringify(payload);
  const chunks = Array.from(
    { length: Math.ceil(serialized.length / NATIVE_BENCHMARK_LOG_CHUNK_SIZE) },
    (_, index) =>
      serialized.slice(
        index * NATIVE_BENCHMARK_LOG_CHUNK_SIZE,
        (index + 1) * NATIVE_BENCHMARK_LOG_CHUNK_SIZE
      )
  );
  const messages = chunks.map(
    (chunk, index) =>
      `${NATIVE_BENCHMARK_CHUNK_MARKER} ${captureId} ${index + 1}/${chunks.length} ${chunk}`
  );
  messages.push(`${NATIVE_BENCHMARK_PASS_MARKER} ${captureId} ${chunks.length}`);
  return messages;
}
