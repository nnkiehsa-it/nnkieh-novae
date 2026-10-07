"use client";

import * as React from "react";
import { Avatar as AvatarPrimitive } from "radix-ui";

import { useDecodedImage } from "./use-decoded-image";
import { cn } from "@/lib/utils";

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "sm" | "lg";
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  onLoadingStatusChange,
  ref,
  src,
  srcSet,
  ...props
}: React.ComponentProps<"img"> & {
  onLoadingStatusChange?: (status: "error" | "idle" | "loaded" | "loading") => void;
}) {
  const sourceKey = src ? `${src}|${srcSet ?? ""}` : "";
  const { imageRef, state } = useDecodedImage(sourceKey);
  const composedRef = React.useCallback((image: HTMLImageElement | null) => {
    imageRef.current = image;
    if (typeof ref === "function") return ref(image);
    if (ref) ref.current = image;
  }, [imageRef, ref]);
  React.useEffect(() => {
    onLoadingStatusChange?.(!src ? "idle" : state === "ready" ? "loaded" : state);
  }, [onLoadingStatusChange, src, state]);

  return (
      <img
        {...props}
        key={sourceKey}
        data-slot="avatar-image"
        data-image-state={state}
        className={cn("t-decoded-image absolute inset-0 z-10 aspect-square size-full object-cover", className)}
        decoding="async"
        ref={composedRef}
        src={src}
        srcSet={srcSet}
      />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className,
      )}
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
};
