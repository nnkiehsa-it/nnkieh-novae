"use client";

import { useEffect, useRef, type ReactNode, type ComponentProps } from "react";
import { PhotoBrowser } from "framework7-react";
import { Button } from "./button";
import { ZoomIn } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { DecodedImage } from "@/components/ui/decoded-image";

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
    <div className="group relative aspect-square overflow-hidden rounded-xl bg-muted/40">
      <Button
        aria-label={t("media.zoom", { alt })}
        className="absolute inset-0 grid h-full min-h-full place-items-center p-1.5"
        disabled={disabled}
        onClick={onOpen}
        type="button"
        variant="ghost"
      >
        {src ? (
          <DecodedImage
            alt={alt}
            className="max-h-full max-w-full object-contain transition-transform duration-[var(--motion-control)] ease-[var(--ease-arrive)] group-hover:scale-[1.03]"
            containerClassName="size-full place-items-center"
            fetchPriority="auto"
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
      </Button>
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
  onOpenChange,
  open,
  src,
}: {
  alt: string;
  height?: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  src?: string;
  width?: number;
}) {
  const { t } = useI18n();
  const browser = useRef<
    NonNullable<ComponentProps<typeof PhotoBrowser>["ref"]>["current"]
  >(null!);
  useEffect(() => {
    if (open) browser.current.open();
    else browser.current.close();
  }, [open]);
  return (
    <PhotoBrowser
      ref={browser}
      type="popup"
      photos={src ? [{ url: src, caption: alt }] : []}
      theme="dark"
      toolbar={false}
      navbarShowCount={false}
      popupCloseLinkText={t("common.close")}
      routableModals={false}
      onPhotoBrowserClosed={() => onOpenChange(false)}
    />
  );
}
