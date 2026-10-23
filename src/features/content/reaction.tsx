import { motion, useReducedMotion } from "motion/react";
import type { Icon } from "@phosphor-icons/react";
import { timing } from "@/lib/motion-timing";
import { Button } from "@/ui/button";
import { AnimatedNumber } from "@/ui/animated-number";

/**
 * Support, like or "me too": a pill that turns white when it is yours. Each
 * new reaction (`burst`) gives the icon one small bounce.
 */
export function ReactionButton({ active, burst, busy, count, disabled, icon: ReactionIcon, label, onClick }: {
  active: boolean;
  burst: number;
  busy: boolean;
  count?: number;
  disabled?: boolean;
  icon: Icon;
  label: string;
  onClick: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <Button
      aria-busy={busy || undefined}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      variant={active ? "primary" : "secondary"}
    >
      <motion.span
        animate={active && burst && !reduced ? { scale: [1, 1.3, 1] } : { scale: 1 }}
        className="grid place-items-center"
        key={burst}
        transition={timing("control", "bounce")}
      >
        <ReactionIcon className="size-5" weight={active ? "fill" : "regular"} />
      </motion.span>
      {count !== undefined ? <AnimatedNumber value={count} /> : <span>{label}</span>}
    </Button>
  );
}
