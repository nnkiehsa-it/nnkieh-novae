/**
 * Newline-delimited JSON, read as it arrives.
 *
 * A chunk off the network does not respect line boundaries — it can end mid
 * object and a single read can carry several lines — so the tail is held back
 * until the newline that completes it arrives.
 */
export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (let end = buffer.indexOf('\n'); end >= 0; end = buffer.indexOf('\n')) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (line) yield JSON.parse(line) as unknown;
      }
    }
    const tail = buffer.trim();
    if (tail) yield JSON.parse(tail) as unknown;
  } finally {
    reader.releaseLock();
  }
}
