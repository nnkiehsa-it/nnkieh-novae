import type { ActionSegment } from "./types.ts";

/**
 * Several independent reads, sent in the order they come back.
 *
 * An action whose answer is assembled from reads that do not need each other
 * used to wait for the slowest of them before anything could be shown. Each
 * one leaves as soon as it lands instead, and a read that fails ends the
 * answer the same way a single failed read always did.
 */
export async function* settledSegments(
  sources: Record<string, PromiseLike<unknown>>,
  whole?: PromiseLike<unknown>,
): AsyncGenerator<ActionSegment> {
  const pending = new Map<symbol, PromiseLike<{ id: symbol; segment: ActionSegment }>>();
  for (const [key, source] of Object.entries(sources)) {
    const id = Symbol(key);
    pending.set(id, source.then((data) => ({ id, segment: { data, key } })));
  }
  if (whole) {
    const id = Symbol("whole");
    pending.set(id, whole.then((data) => ({ id, segment: { data } })));
  }
  while (pending.size > 0) {
    const settled = await Promise.race(pending.values());
    pending.delete(settled.id);
    yield settled.segment;
  }
}
