export const MINIMUM_SKELETON_DURATION_MS = 280;

export async function waitForMinimumSkeletonDuration(startedAt: number) {
  const remaining = MINIMUM_SKELETON_DURATION_MS - (Date.now() - startedAt);
  if (remaining <= 0) return;
  await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
}
