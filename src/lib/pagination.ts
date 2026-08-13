export function mergePageById<T extends { id: string }>(
  current: readonly T[],
  incoming: readonly T[],
) {
  const merged = [...current];
  const indexById = new Map(current.map((item, index) => [item.id, index]));
  for (const item of incoming) {
    const existingIndex = indexById.get(item.id);
    if (existingIndex === undefined) {
      indexById.set(item.id, merged.length);
      merged.push(item);
    } else {
      merged[existingIndex] = item;
    }
  }
  return merged;
}

function cursorFingerprint(cursor: unknown) {
  if (cursor === null || cursor === undefined) return "";
  return JSON.stringify(cursor);
}

export function canContinuePage(
  requestedCursor: unknown,
  returnedCursor: unknown,
  serverHasMore: boolean,
) {
  if (!serverHasMore || returnedCursor === null || returnedCursor === undefined)
    return false;
  return (
    requestedCursor === null ||
    requestedCursor === undefined ||
    cursorFingerprint(requestedCursor) !== cursorFingerprint(returnedCursor)
  );
}
