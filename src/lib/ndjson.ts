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
  let finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) { finished = true; buffer += decoder.decode(); break; }
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
    if (!finished) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
