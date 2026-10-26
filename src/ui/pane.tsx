import * as React from "react";
import { cssEasing, timingMs } from "@/lib/motion-timing";

/**
 * Which way a row of sibling views moved: 1 when the new one sits further
 * along than the last, -1 when it sits before it, 0 on the first render or
 * when either is not in the row. A position with several parts (a view, then
 * a category inside it) compares the first part that differs.
 */
export function useStepDirection(step: string, position: number | readonly number[]) {
  const parts = typeof position === "number" ? [position] : position;
  const [last, setLast] = React.useState({ direction: 0, parts, step });
  if (last.step === step) return last.direction;
  const direction = compareSteps(last.parts, parts);
  setLast({ direction, parts, step });
  return direction;
}

function compareSteps(from: readonly number[], to: readonly number[]) {
  if (from.some((part) => part < 0) || to.some((part) => part < 0)) return 0;
  for (let index = 0; index < Math.min(from.length, to.length); index += 1) {
    if (from[index] !== to[index]) return Math.sign(to[index] - from[index]);
  }
  return 0;
}

export interface PaneStep {
  /** From `useStepDirection`. */
  direction: number;
  /** Which view is shown; the pane plays whenever it changes. */
  step: string;
}

/**
 * The content behind a Segmented control, or any row of sibling views. A
 * view further along the row slides in from the right and one before it from
 * the left, as if the views sat side by side, instead of every view rising
 * from below. Nothing is remounted to play it, so a view keeps its state; a
 * pane that is itself new (its parent swapped it in) plays on arrival.
 *
 * Content the switch brings in arrives with the pane: its own rise is
 * finished at once, so it does not drift upward while the pane moves sideways.
 */
export function Pane({ children, className, direction, step }: PaneStep & {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const shown = React.useRef<string | null>(null);
  React.useLayoutEffect(() => {
    const arriving = shown.current === null;
    if (shown.current === step) return;
    shown.current = step;
    const element = ref.current;
    if (!element || (arriving && direction === 0)) return;
    for (const animation of element.getAnimations({ subtree: true })) {
      if (animation instanceof CSSAnimation && animation.animationName === "content-in") animation.finish();
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const travel = still ? 0 : direction * Number.parseFloat(getComputedStyle(element).getPropertyValue("--motion-route-travel"));
    element.animate(
      [{ opacity: 0, translate: `${travel || 0}px 0` }, { opacity: 1, translate: "0 0" }],
      { duration: timingMs("control"), easing: cssEasing("arrive") },
    );
  }, [direction, step]);
  return <div className={className} ref={ref}>{children}</div>;
}
