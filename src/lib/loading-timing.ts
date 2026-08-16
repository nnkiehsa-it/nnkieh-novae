export const SKELETON_APPEAR_DELAY_MS = 120;
export const MINIMUM_SKELETON_VISIBLE_DURATION_MS = 180;
export const SKELETON_REVEAL_DURATION_MS = 240;

export function getMinimumSkeletonWaitMs(startedAt: number, now = Date.now()) {
  const elapsed = Math.max(0, now - startedAt);
  if (elapsed < SKELETON_APPEAR_DELAY_MS) return 0;
  return Math.max(
    0,
    SKELETON_APPEAR_DELAY_MS +
      MINIMUM_SKELETON_VISIBLE_DURATION_MS -
      elapsed,
  );
}

export async function waitForMinimumSkeletonDuration(startedAt: number) {
  const remaining = getMinimumSkeletonWaitMs(startedAt);
  if (remaining <= 0) return;
  await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
}
