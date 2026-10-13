"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { ImageBroken, MagnifyingGlassPlus } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useDecodedImage } from "./use-decoded-image";

/** An image that stays hidden behind a placeholder until it has decoded. */
export function DecodedImage({
  className,
  containerClassName,
  decoding = "async",
  ref,
  src,
  srcSet,
  ...props
}: React.ComponentProps<"img"> & { containerClassName?: string }) {
  const sourceKey = src ? `${src}|${srcSet ?? ""}` : "";
  const { imageRef, state } = useDecodedImage(sourceKey);
  const composedRef = React.useCallback((image: HTMLImageElement | null) => {
    imageRef.current = image;
    if (typeof ref === "function") return ref(image);
    if (ref) ref.current = image;
  }, [imageRef, ref]);

  return (
    <span className={cn("relative grid overflow-hidden", containerClassName)} data-image-state={state}>
      {state === "loading" ? <span aria-hidden className="skeleton pointer-events-none absolute inset-0 rounded-[inherit] bg-surface-raised" /> : null}
      {state === "error" ? (
        <span aria-hidden className="pointer-events-none col-start-1 row-start-1 grid place-items-center text-ink-faint">
          <ImageBroken className="size-5" />
        </span>
      ) : null}
      {/* Signed upload URLs are not served through the image optimizer. */}
      <img
        {...props}
        className={cn(
          "col-start-1 row-start-1 transition-opacity duration-[var(--motion-reveal)] ease-[var(--ease-arrive)]",
          state === "ready" ? "opacity-100" : "opacity-0",
          className,
        )}
        data-image-state={state}
        decoding={decoding}
        key={sourceKey}
        ref={composedRef}
        src={src}
        srcSet={srcSet}
      />
    </span>
  );
}

/** Square tiles that fit each image inside rather than cropping it. */
export function ImageGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2", className)}>{children}</div>;
}

export function ImageTile({ actions, alt, disabled = false, height, onOpen, placeholder, src, width }: {
  /** Controls drawn over the tile, such as removal. Never inside its button. */
  actions?: React.ReactNode;
  alt: string;
  disabled?: boolean;
  height?: number;
  onOpen: () => void;
  /** Stands in while the image has no source yet. */
  placeholder?: React.ReactNode;
  src?: string;
  width?: number;
}) {
  const { t } = useI18n();
  return (
    <div className="group relative aspect-square overflow-hidden rounded-tile bg-surface-raised">
      <button
        aria-label={t("media.zoom", { alt })}
        className="absolute inset-0 grid place-items-center p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        disabled={disabled}
        onClick={onOpen}
        type="button"
      >
        {src ? (
          <DecodedImage
            alt={alt}
            className="max-h-full max-w-full rounded-chip object-contain"
            containerClassName="size-full place-items-center"
            height={height}
            loading="eager"
            src={src}
            width={width}
          />
        ) : (
          <span className="grid size-full place-items-center text-ink-faint">{placeholder}</span>
        )}
      </button>
      {src && !disabled ? (
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-[var(--scrim)] text-ink opacity-0 transition-opacity duration-[var(--motion-control)] group-hover:opacity-100">
          <MagnifyingGlassPlus className="size-3.5" weight="bold" />
        </span>
      ) : null}
      {actions}
    </div>
  );
}

/** One image at the size of the screen. */
export function ImageLightbox({ alt, height, onOpenChange, open, src, width }: {
  alt: string;
  height?: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  src?: string;
  width?: number;
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-md" />
        <Dialog.Content
          aria-describedby={undefined}
          className="dialog-surface fixed inset-0 z-50 grid place-items-center p-4 outline-none"
          onClick={() => onOpenChange(false)}
        >
          <Dialog.Title className="sr-only">{alt}</Dialog.Title>
          {src ? (
            <DecodedImage
              alt={alt}
              className="max-h-[calc(100svh-2rem)] max-w-full rounded-tile object-contain"
              containerClassName="max-w-[min(100%,70rem)] place-items-center"
              height={height}
              src={src}
              width={width}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
