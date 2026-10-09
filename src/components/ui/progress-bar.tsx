"use client";
import { Progressbar } from "framework7-react";
export function ProgressBar({
  className,
  label,
  percent,
}: {
  className?: string;
  label: string;
  percent: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const accessibility = {
    "aria-label": label,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": clamped,
    role: "progressbar",
  };
  return (
    <Progressbar {...accessibility} className={className} progress={clamped} />
  );
}
