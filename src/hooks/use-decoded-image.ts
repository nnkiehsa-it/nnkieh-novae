"use client";

import { useLayoutEffect, useRef, useState } from "react";

export type ImageLoadState = "error" | "loading" | "ready";

/** Decode the displayed element itself before revealing any pixels. */
export function useDecodedImage(sourceKey: string) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [resolved, setResolved] = useState<{ sourceKey: string; state: ImageLoadState }>({
    sourceKey: "", state: "loading",
  });
  const state = !sourceKey ? "error" : resolved.sourceKey === sourceKey ? resolved.state : "loading";

  useLayoutEffect(() => {
    const image = imageRef.current;
    if (!image || !sourceKey) return;
    let active = true;
    let decoding = false;
    const fail = () => {
      if (active) setResolved({ sourceKey, state: "error" });
    };
    const reveal = async () => {
      if (decoding) return;
      decoding = true;
      try {
        await image.decode();
        if (active) setResolved({ sourceKey, state: "ready" });
      } catch {
        fail();
      }
    };
    image.addEventListener("load", reveal);
    image.addEventListener("error", fail);
    // A cached image can complete before React attaches its load handler.
    if (image.complete) {
      if (image.naturalWidth > 0) void reveal();
      else fail();
    }
    return () => {
      active = false;
      image.removeEventListener("load", reveal);
      image.removeEventListener("error", fail);
    };
  }, [sourceKey]);

  return { imageRef, state };
}
