export const MOTION_SMOOTH_SPRING = {
  type: 'spring',
  stiffness: 170,
  damping: 25,
  mass: 0.9,
} as const;

export const MOTION_SOFT_SPRING = {
  type: 'spring',
  stiffness: 130,
  damping: 23,
  mass: 1,
} as const;

export const MOTION_SMOOTH_TWEEN = {
  duration: 0.38,
  ease: [0.16, 1, 0.3, 1],
} as const;

export const MOTION_ROUTE_TRANSITION = {
  duration: 0.44,
  ease: [0.16, 1, 0.3, 1],
} as const;

export function getStaggerTransition(index: number, delay = 0) {
  return {
    ...MOTION_SMOOTH_TWEEN,
    delay: delay + Math.min(index, 8) * 0.055,
  };
}
