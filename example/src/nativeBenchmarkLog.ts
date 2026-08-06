export const NATIVE_BENCHMARK_CHUNK_MARKER = 'RNICK_BENCHMARK_CHUNK';
export const NATIVE_BENCHMARK_PASS_MARKER = 'RNICK_BENCHMARK_PASS';
export const NATIVE_BENCHMARK_LOG_CHUNK_SIZE = 480;

type ChunkedLogMarkers = {
  chunk: string;
  pass: string;
};

export function createNativeBenchmarkLogMessages(
  payload: unknown,
  captureId: string
): string[] {
  return createChunkedNativeLogMessages(payload, captureId, {
    chunk: NATIVE_BENCHMARK_CHUNK_MARKER,
    pass: NATIVE_BENCHMARK_PASS_MARKER,
  });
}

export function createChunkedNativeLogMessages(
  payload: unknown,
  captureId: string,
  markers: ChunkedLogMarkers
): string[] {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(captureId)) {
    throw new Error('Native benchmark capture ID must be a lowercase identifier.');
  }
  if (!/^[A-Z0-9_]+$/.test(markers.chunk) || !/^[A-Z0-9_]+$/.test(markers.pass)) {
    throw new Error('Native benchmark log markers must be uppercase identifiers.');
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
      `${markers.chunk} ${captureId} ${index + 1}/${chunks.length} ${chunk}`
  );
  messages.push(`${markers.pass} ${captureId} ${chunks.length}`);
  return messages;
}
