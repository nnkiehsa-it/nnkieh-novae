"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";
import { useDecodedImage } from "./use-decoded-image";
import { cn } from "@/lib/utils";

export function DecodedImage({
  className,
  containerClassName,
  decoding = "async",
  indicatorClassName,
  ref,
  src,
  srcSet,
  ...props
}: React.ComponentProps<"img"> & {
  containerClassName?: string;
  indicatorClassName?: string;
}) {
  const sourceKey = src ? `${src}|${srcSet ?? ""}` : "";
  const { imageRef, state } = useDecodedImage(sourceKey);
  const composedRef = React.useCallback((image: HTMLImageElement | null) => {
    imageRef.current = image;
    if (typeof ref === "function") return ref(image);
    if (ref) ref.current = image;
  }, [imageRef, ref]);

  return (
    <span
      className={cn("relative grid overflow-hidden", containerClassName)}
      data-image-state={state}
    >
      {state === "loading" ? (
        <span
          aria-hidden
          className="t-image-placeholder pointer-events-none absolute inset-0 rounded-[inherit] bg-muted/40"
        />
      ) : null}
      {state === "error" ? (
        <span
          aria-hidden
          className="pointer-events-none col-start-1 row-start-1 grid place-items-center text-muted-foreground"
        >
          <ImageOff className={cn("size-5", indicatorClassName)} />
        </span>
      ) : null}
      <img
        {...props}
        key={sourceKey}
        className={cn("t-decoded-image col-start-1 row-start-1", className)}
        data-image-state={state}
        decoding={decoding}
        ref={composedRef}
        src={src}
        srcSet={srcSet}
      />
    </span>
  );
}
