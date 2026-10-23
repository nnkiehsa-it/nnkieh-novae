import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  extractMarkdownImages,
  getUploadIdsFromMarkdown,
  replaceMarkdownImageSources,
} from "@/lib/markdown-images";
import { queryClient } from "@/lib/query-client";
import {
  getResolvedUploadReference,
  REFERENCE_MAX_AGE_MS,
  resolveUploadImageUrls,
  type ResolvedImages,
} from "@/services/upload-delivery";
import type { MarkdownImageRecord } from "@/types";

function cachedReferences(uploadIds: string[]) {
  return Object.fromEntries(uploadIds.flatMap((id) => {
    const reference = getResolvedUploadReference(id);
    return reference ? [[id, reference] as const] : [];
  }));
}

export function useResolvedMarkdown(content: string) {
  const uploadIds = React.useMemo(() => getUploadIdsFromMarkdown(content), [content]);
  const queryKey = React.useMemo(() => ["uploads", "set", uploadIds.join("|")], [uploadIds]);
  const query = useQuery({
    enabled: uploadIds.length > 0,
    // Private images are signed links that only this tab may hold.
    meta: { persist: false },
    queryKey,
    queryFn: () => resolveUploadImageUrls(uploadIds),
    staleTime: REFERENCE_MAX_AGE_MS,
  });
  const references: ResolvedImages = query.data ?? cachedReferences(uploadIds);
  // Whether the server has answered: an image it left out cannot be shown.
  const settled = query.isSuccess || query.isError;

  const images = React.useMemo<MarkdownImageRecord[]>(
    () =>
      extractMarkdownImages(content).map((image) => {
        const uploadId = image.uploadId;
        if (!uploadId) return image;
        const resolvedImage = references[uploadId];
        return {
          ...image,
          fullSrc: resolvedImage?.fullUrl,
          isUploadResolved: Boolean(resolvedImage),
          resolveError: settled && !resolvedImage ? "not-found" : undefined,
          src: resolvedImage?.thumbnailUrl ?? "",
        };
      }),
    [content, references, settled],
  );

  /** Signs one image again, for a link about to lapse. */
  const refresh = React.useCallback(async (uploadId: string) => {
    const images = await resolveUploadImageUrls([uploadId], { forceRefresh: true });
    queryClient.setQueryData<ResolvedImages>(queryKey, (current) => {
      const next = { ...current };
      delete next[uploadId];
      return { ...next, ...images };
    });
    return images[uploadId] ?? null;
  }, [queryKey]);

  return {
    images,
    references,
    refresh,
    resolvedContent: replaceMarkdownImageSources(
      content,
      Object.fromEntries(Object.entries(references).map(([id, image]) => [id, image.fullUrl])),
      { unresolvedUpload: "remove" },
    ),
  };
}
