"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";

type ImageLoadState = "error" | "loading" | "ready";

export function DecodedImage({
  className,
  containerClassName,
  decoding = "async",
  indicatorClassName,
  onError,
  onLoad,
  src,
  ...props
}: React.ComponentProps<"img"> & {
  containerClassName?: string;
  indicatorClassName?: string;
}) {
  const sourceKey = typeof src === "string" ? src : "";
  const [resolved, setResolved] = React.useState<{
    sourceKey: string;
    state: ImageLoadState;
  }>({ sourceKey: "", state: "loading" });
  const state = resolved.sourceKey === sourceKey
    ? resolved.state
    : sourceKey
      ? "loading"
      : "error";

  const handleLoad = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      onLoad?.(event);
      const image = event.currentTarget;
      const loadedSource = sourceKey;
      const decoding = typeof image.decode === "function"
        ? image.decode().catch(() => undefined)
        : Promise.resolve();
      void decoding.then(() => {
        setResolved({ sourceKey: loadedSource, state: "ready" });
      });
    },
    [onLoad, sourceKey],
  );

  const handleError = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      setResolved({ sourceKey, state: "error" });
      onError?.(event);
    },
    [onError, sourceKey],
  );

  return (
    <span
      className={cn("relative grid overflow-hidden", containerClassName)}
      data-image-state={state}
    >
      {state === "loading" ? (
        <span
          aria-hidden
          className="pointer-events-none col-start-1 row-start-1 grid place-items-center text-muted-foreground"
        >
          <LoadingSpinner className={cn("size-5", indicatorClassName)} />
        </span>
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
        className={cn("t-decoded-image col-start-1 row-start-1", className)}
        data-image-state={state}
        decoding={decoding}
        onError={handleError}
        onLoad={handleLoad}
        src={src}
      />
    </span>
  );
}
