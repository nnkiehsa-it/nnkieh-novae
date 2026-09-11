import {
  motionEasing,
  motionSeconds,
  type MotionCurve,
  type MotionRung,
} from "@/generated/motion-tokens";

/**
 * A transition for an animation driven from JavaScript, expressed on the same
 * ladder the stylesheet uses. Nothing animated in the product states a raw
 * duration or curve of its own: both come from `config/motion.config.json`, so
 * retuning the ladder retunes CSS and JavaScript together.
 */
export function timing(rung: MotionRung, curve: MotionCurve = "arrive") {
  return { duration: motionSeconds[rung], ease: motionEasing[curve] };
}

/** The same rung as a plain millisecond count, for timers that shadow an animation. */
export function timingMs(rung: MotionRung) {
  return motionSeconds[rung] * 1_000;
}
