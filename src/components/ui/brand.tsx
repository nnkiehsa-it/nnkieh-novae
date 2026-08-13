import Link from "next/link";

import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  imageClassName,
}: {
  className?: string;
  imageClassName?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white shadow-[var(--shadow-control)] dark:bg-black",
        className,
      )}
    >
      <img
        alt=""
        className={cn("size-8 dark:invert", imageClassName)}
        src="/logo.svg"
      />
    </span>
  );
}

export function BrandLockup({
  className,
  href,
  markClassName,
}: {
  className?: string;
  href?: string;
  markClassName?: string;
}) {
  const content = (
    <>
      <BrandMark className={markClassName} />
      <span className="font-semibold">Novae</span>
    </>
  );

  if (!href) {
    return <div className={cn("flex items-center gap-2.5", className)}>{content}</div>;
  }

  return (
    <Link
      className={cn(
        "group flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
      href={href}
    >
      {content}
    </Link>
  );
}
