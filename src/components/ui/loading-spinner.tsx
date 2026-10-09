"use client";

import { cn } from "@/lib/utils";

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
      <span className={cn("preloader size-5", iconClassName)}>
        <span className="preloader-inner">
          {Array.from({ length: 8 }, (_, index) => (
            <span className="preloader-inner-line" key={index} />
          ))}
        </span>
      </span>
    </span>
  );
}
