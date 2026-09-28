import Link from "next/link";
import Image from "next/image";
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
        "grid size-12 aspect-square shrink-0 place-items-center",
        className,
      )}
    >
      <Image
        alt=""
        className={cn(
          "block size-full aspect-square object-contain",
          imageClassName,
        )}
        src="/logo.svg"
        width={48}
        height={48}
        loading="eager"
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
      <span className="text-xl font-bold tracking-[-0.055em]">Novae</span>
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
      prefetch
    >
      {content}
    </Link>
  );
}
