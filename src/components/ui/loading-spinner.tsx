"use client";

import { cn } from "@/lib/utils";
import { Preloader } from "framework7-react";

export function LoadingSpinner({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("t-loading-spinner", className)}
      data-slot="loading-spinner"
    >
      <Preloader size={20} className={iconClassName} />
    </span>
  );
}
