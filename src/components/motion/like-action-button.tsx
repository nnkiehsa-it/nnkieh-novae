"use client";

import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { cn } from "@/lib/utils";

const heartParticles = [
  { delay: "0ms", duration: "560ms", scale: 0.65, size: 0.9, x: "-18px", y: "-18px" },
  { delay: "15ms", duration: "610ms", scale: 0.5, size: 1.1, x: "0px", y: "-22px" },
  { delay: "5ms", duration: "580ms", scale: 0.7, size: 0.8, x: "18px", y: "-17px" },
  { delay: "25ms", duration: "640ms", scale: 0.55, size: 1, x: "-22px", y: "0px" },
  { delay: "0ms", duration: "600ms", scale: 0.6, size: 1.15, x: "22px", y: "1px" },
  { delay: "20ms", duration: "620ms", scale: 0.5, size: 0.85, x: "-16px", y: "17px" },
  { delay: "10ms", duration: "570ms", scale: 0.7, size: 1, x: "0px", y: "20px" },
  { delay: "30ms", duration: "650ms", scale: 0.55, size: 0.9, x: "17px", y: "17px" },
];

const handParticles = [
  { delay: "20ms", duration: "520ms", scale: 0.45, size: 0.75, x: "-16px", y: "-13px" },
  { delay: "0ms", duration: "580ms", scale: 0.55, size: 1, x: "-9px", y: "-22px" },
  { delay: "35ms", duration: "610ms", scale: 0.5, size: 0.85, x: "0px", y: "-26px" },
  { delay: "10ms", duration: "560ms", scale: 0.6, size: 0.9, x: "9px", y: "-23px" },
  { delay: "25ms", duration: "540ms", scale: 0.45, size: 0.7, x: "17px", y: "-15px" },
];

export function LikeActionButton({
  active,
  burst,
  busy,
  className,
  count,
  disabled,
  icon: Icon,
  label,
  onClick,
  reaction = "hand",
  size = "icon-lg",
  variant = "default",
}: {
  active: boolean;
  burst: number;
  busy: boolean;
  className?: string;
  count?: number;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  reaction?: "hand" | "heart";
  size?: "icon-lg" | "sm";
  variant?: "default" | "ghost";
}) {
  const [celebrationBurst, setCelebrationBurst] = React.useState(0);

  React.useEffect(() => {
    if (burst <= 0) return;
    setCelebrationBurst(burst);
    const celebrationTimeout = window.setTimeout(() => {
      setCelebrationBurst(0);
    }, 660);
    return () => window.clearTimeout(celebrationTimeout);
  }, [burst]);

  const particles = reaction === "heart" ? heartParticles : handParticles;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-busy={busy}
          className={cn("t-like relative overflow-visible", busy && "opacity-70", className)}
          data-accent={reaction}
          data-celebrating={active && celebrationBurst ? celebrationBurst : undefined}
          data-liked={active}
          disabled={disabled || busy}
          onClick={onClick}
          size={size}
          variant={active ? "secondary" : variant}
        >
          <span className="t-action-icon">
            <span className="t-like-icon">
              <Icon
                className="t-reaction-icon"
                fill={active && reaction === "heart" ? "currentColor" : "none"}
                strokeWidth={2}
              />
            </span>
          </span>
          {count !== undefined ? <AnimatedNumber value={count} /> : null}
          {active && celebrationBurst > 0
            ? (
                <span className="t-like-particles" key={celebrationBurst}>
                  {particles.map((particle, index) => (
                    <i
                      key={index}
                      style={
                        {
                          "--pdelay": particle.delay,
                          "--pdur": particle.duration,
                          "--p-end-scale": particle.scale,
                          "--psize": particle.size,
                          "--px": particle.x,
                          "--py": particle.y,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </span>
              )
            : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
