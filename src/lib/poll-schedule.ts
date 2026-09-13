const LADDER = [1_000, 2_000, 3_000, 5_000, 8_000, 15_000] as const;

/**
 * How long to wait before looking again at work the reader just queued.
 *
 * A fixed one-second poll is how the administration screens used to behave, and
 * it kept asking at the same rate an hour later. Waiting a little longer each
 * time answers quickly while the answer is still likely to have changed, and
 * then settles down. It never gives up on its own: the caller stops when the
 * work it is watching is finished.
 */
export function nextPollDelay(attempt: number) {
  if (attempt < 0) return LADDER[0];
  return LADDER[Math.min(attempt, LADDER.length - 1)];
}
