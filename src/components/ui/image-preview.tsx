"use client";

import type { ReactNode } from "react";
import { ZoomIn } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { DecodedImage } from "@/components/ui/decoded-image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * The one way an image is shown before it is opened.
 *
 * A thumbnail that crops to a fixed frame turns a tall photograph into its
 * middle third, which is exactly the part a reader cannot use to tell one
 * attachment from another. So the tile is a fixed square the images are fitted
 * inside rather than cut to: a wide picture keeps its width, a tall one keeps
 * its height, and the row stays aligned because the tiles never change shape.
 */
export function ImagePreviewGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ImagePreviewTile({
  actions,
  alt,
  disabled = false,
  height,
  onOpen,
  placeholder,
  src,
  width,
}: {
  /** Controls drawn over the tile, such as removal. Never inside its button. */
  actions?: ReactNode;
  alt: string;
  disabled?: boolean;
  height?: number;
  onOpen: () => void;
  /** Stands in while the image has no source yet. */
  placeholder?: ReactNode;
  src?: string;
  width?: number;
}) {
  const { t } = useI18n();
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border bg-muted/40">
      <button
        aria-label={t("media.zoom", { alt })}
        className="absolute inset-0 grid place-items-center p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        disabled={disabled}
        onClick={onOpen}
        type="button"
      >
        {src ? (
          <DecodedImage
            alt={alt}
            className="max-h-full max-w-full object-contain transition-transform duration-[var(--motion-control)] ease-[var(--ease-arrive)] group-hover:scale-[1.03]"
            containerClassName="size-full place-items-center"
            fetchPriority="low"
            height={height}
            loading="eager"
            src={src}
            width={width}
          />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            {placeholder}
          </span>
        )}
      </button>
      {src && !disabled ? (
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 grid size-6 translate-y-1 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-[opacity,transform] duration-[var(--motion-control-exit)] group-hover:translate-y-0 group-hover:opacity-100">
          <ZoomIn className="size-3" />
        </span>
      ) : null}
      {actions}
    </div>
  );
}

export function ImageLightbox({
  alt,
  height,
  onOpenChange,
  open,
  src,
  width,
}: {
  alt: string;
  height?: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  src?: string;
  width?: number;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-[min(92vw,70rem)] border-0 bg-transparent p-0 shadow-none sm:max-w-[min(92vw,70rem)]">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        {src ? (
          <DecodedImage
            alt={alt}
            className="max-h-[calc(100svh-3rem)] w-full rounded-xl object-contain"
            containerClassName="min-h-48 w-full place-items-center rounded-xl bg-black/20"
            height={height}
            src={src}
            width={width}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
