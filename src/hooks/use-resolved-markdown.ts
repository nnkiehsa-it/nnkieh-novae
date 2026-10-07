"use client";

import * as React from "react";
import {
  extractMarkdownImages,
  getUploadIdsFromMarkdown,
  replaceMarkdownImageSources,
} from "@/lib/markdown-images";
import { resolveUploadImageUrls } from "@/services/uploads";
import { getResolvedUploadReference } from "@/services/upload-delivery";
import { useSession } from "@/hooks/use-session";
import { subscribeContentCacheInvalidations } from "@/services/content-read-cache";
import type { MarkdownImageRecord } from "@/types";

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
  const cached = React.useMemo(() => {
    const entries = uploadIds.flatMap((id) => {
      const entry = getResolvedUploadReference(id);
      return entry ? [[id, entry] as const] : [];
    });
    return {
      errors: {} as Record<string, string>,
      fullUrls: Object.fromEntries(entries.map(([id, entry]) => [id, entry.fullUrl])),
      thumbnailUrls: Object.fromEntries(entries.map(([id, entry]) => [id, entry.thumbnailUrl])),
      expiresAtByUploadId: Object.fromEntries(entries.map(([id, entry]) => [id, entry.expiresAtMs])),
    };
    // The account and upload IDs are the identity of this reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadKey, revision]);
  const [resolved, setResolved] = React.useState({ key: uploadKey, ...cached });
  const { errors, fullUrls, thumbnailUrls, expiresAtByUploadId } = resolved.key === uploadKey ? resolved : cached;

  React.useEffect(() => {
    let active = true;
    if (uploadIds.length === 0) {
      return;
    }
    void resolveUploadImageUrls(uploadIds)
      .then((result) => {
        if (!active) return;
        setResolved({ key: uploadKey, ...result });
      })
      .catch(() => {
        if (active)
          setResolved({ key: uploadKey, ...cached, errors: Object.fromEntries(uploadIds.map((id) => [id, "resolve-failed"])) });
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
    setResolved((current) => {
      const next = { ...current,
        fullUrls: { ...current.fullUrls }, thumbnailUrls: { ...current.thumbnailUrls },
        expiresAtByUploadId: { ...current.expiresAtByUploadId }, errors: { ...current.errors },
      };
      if (next.key !== uploadKey) return current;
      delete next.fullUrls[uploadId]; delete next.thumbnailUrls[uploadId];
      delete next.expiresAtByUploadId[uploadId]; delete next.errors[uploadId];
      Object.assign(next.fullUrls, result.fullUrls); Object.assign(next.thumbnailUrls, result.thumbnailUrls);
      Object.assign(next.expiresAtByUploadId, result.expiresAtByUploadId); Object.assign(next.errors, result.errors);
      return next;
    });
    return result;
  }, [uploadKey]);

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
