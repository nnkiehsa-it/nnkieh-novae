"use client";

import * as React from "react";
import {
  extractMarkdownImages,
  getUploadIdsFromMarkdown,
  replaceMarkdownImageSources,
} from "@/lib/markdown-images";
import { resolveUploadImageUrls } from "@/services/uploads";
import type { MarkdownImageRecord } from "@/types";

export function useResolvedMarkdown(content: string) {
  const [fullUrls, setFullUrls] = React.useState<Record<string, string>>({});
  const [thumbnailUrls, setThumbnailUrls] = React.useState<
    Record<string, string>
  >({});
  const [expiresAtByUploadId, setExpiresAt] = React.useState<
    Record<string, number>
  >({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const uploadIds = React.useMemo(
    () => getUploadIdsFromMarkdown(content),
    [content],
  );
  const uploadKey = uploadIds.join("|");

  React.useEffect(() => {
    let active = true;
    if (uploadIds.length === 0) {
      setFullUrls({});
      setThumbnailUrls({});
      setExpiresAt({});
      setErrors({});
      return;
    }
    void resolveUploadImageUrls(uploadIds)
      .then((result) => {
        if (!active) return;
        setFullUrls(result.fullUrls);
        setThumbnailUrls(result.thumbnailUrls);
        setExpiresAt(result.expiresAtByUploadId);
        setErrors(result.errors ?? {});
      })
      .catch(() => {
        if (active)
          setErrors(
            Object.fromEntries(uploadIds.map((id) => [id, "resolve-failed"])),
          );
      });
    return () => {
      active = false;
    };
    // uploadKey is the stable identity of the IDs to resolve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadKey]);

  const images = React.useMemo<MarkdownImageRecord[]>(
    () =>
      extractMarkdownImages(content).map((image) => {
        const uploadId = image.uploadId;
        if (!uploadId) return image;
        return {
          ...image,
          fullSrc: fullUrls[uploadId],
          isUploadResolved: Boolean(thumbnailUrls[uploadId]),
          resolveError: errors[uploadId],
          src: thumbnailUrls[uploadId] ?? "",
        };
      }),
    [content, errors, fullUrls, thumbnailUrls],
  );

  const refresh = React.useCallback(async (uploadId: string) => {
    const result = await resolveUploadImageUrls([uploadId], {
      forceRefresh: true,
    });
    setFullUrls((current) => ({ ...current, ...result.fullUrls }));
    setThumbnailUrls((current) => ({ ...current, ...result.thumbnailUrls }));
    setExpiresAt((current) => ({ ...current, ...result.expiresAtByUploadId }));
    setErrors((current) => ({ ...current, ...(result.errors ?? {}) }));
  }, []);

  return {
    errors,
    expiresAtByUploadId,
    images,
    refresh,
    resolvedContent: replaceMarkdownImageSources(content, fullUrls, {
      unresolvedUpload: "remove",
    }),
  };
}
