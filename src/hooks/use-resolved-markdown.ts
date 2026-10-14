"use client";

import * as React from "react";
import {
  extractMarkdownImages,
  getUploadIdsFromMarkdown,
  replaceMarkdownImageSources,
} from "@/lib/markdown-images";
import { resolveUploadImageUrls } from "@/services/uploads";
import { getResolvedUploadReference, type ResolvedImages } from "@/services/upload-delivery";
import { useSession } from "@/hooks/use-session";
import { subscribeContentCacheInvalidations } from "@/services/content-read-cache";
import type { MarkdownImageRecord } from "@/types";

interface Reading {
  key: string;
  images: ResolvedImages;
  /** Whether the server has answered: an image it left out cannot be shown. */
  settled: boolean;
}

export function useResolvedMarkdown(content: string) {
  const { user } = useSession();
  const uploadIds = React.useMemo(
    () => getUploadIdsFromMarkdown(content),
    [content],
  );
  const uploadKey = `${user?.uid ?? ""}|${uploadIds.join("|")}`;
  const [revision, invalidate] = React.useReducer((value: number) => value + 1, 0);
  React.useEffect(() => subscribeContentCacheInvalidations((prefix) => {
    if (prefix.startsWith("upload-media-v2|")) invalidate();
  }), []);
  const cached = React.useMemo<Reading>(() => ({
    key: uploadKey,
    images: Object.fromEntries(uploadIds.flatMap((id) => {
      const entry = getResolvedUploadReference(id);
      return entry ? [[id, entry] as const] : [];
    })),
    settled: false,
    // The account and upload IDs are the identity of this reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [uploadKey, revision]);
  const [resolved, setResolved] = React.useState<Reading>(cached);
  const reading = resolved.key === uploadKey ? resolved : cached;

  React.useEffect(() => {
    let active = true;
    if (uploadIds.length === 0) {
      return;
    }
    void resolveUploadImageUrls(uploadIds)
      .then((images) => {
        if (active) setResolved({ key: uploadKey, images, settled: true });
      })
      .catch(() => {
        if (active) setResolved({ ...cached, settled: true });
      });
    return () => {
      active = false;
    };
    // uploadKey is the stable identity of the IDs to resolve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadKey, revision]);

  const images = React.useMemo<MarkdownImageRecord[]>(
    () =>
      extractMarkdownImages(content).map((image) => {
        const uploadId = image.uploadId;
        if (!uploadId) return image;
        const resolvedImage = reading.images[uploadId];
        return {
          ...image,
          fullSrc: resolvedImage?.fullUrl,
          isUploadResolved: Boolean(resolvedImage),
          resolveError: reading.settled && !resolvedImage ? "not-found" : undefined,
          src: resolvedImage?.thumbnailUrl ?? "",
        };
      }),
    [content, reading],
  );

  /** Signs one image again, for a link about to lapse. */
  const refresh = React.useCallback(async (uploadId: string) => {
    const images = await resolveUploadImageUrls([uploadId], { forceRefresh: true });
    setResolved((current) => {
      if (current.key !== uploadKey) return current;
      const next = { ...current.images };
      delete next[uploadId];
      return { ...current, images: { ...next, ...images } };
    });
    return images[uploadId] ?? null;
  }, [uploadKey]);

  return {
    images,
    references: reading.images,
    refresh,
    resolvedContent: replaceMarkdownImageSources(
      content,
      Object.fromEntries(Object.entries(reading.images).map(([id, image]) => [id, image.fullUrl])),
      { unresolvedUpload: "remove" },
    ),
  };
}
