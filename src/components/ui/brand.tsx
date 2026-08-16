import Link from "next/link";

import { DecodedImage } from "@/components/ui/decoded-image";
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
        "grid size-12 aspect-square shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-2.5 shadow-[var(--shadow-control)] dark:bg-black",
        className,
      )}
    >
      <DecodedImage
        alt=""
        className={cn(
          "block size-full aspect-square object-contain dark:invert",
          imageClassName,
        )}
        containerClassName="size-full"
        indicatorClassName="size-4"
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
      <span className="text-base font-semibold">Novae</span>
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
