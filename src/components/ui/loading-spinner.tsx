"use client";

import { Preloader } from "framework7-react";
import { cn } from "@/lib/utils";

export function LoadingSpinner({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span aria-hidden className={cn("t-loading-spinner", className)} data-slot="loading-spinner">
      <Preloader className={iconClassName} size={20} />
    </span>
  );
}
