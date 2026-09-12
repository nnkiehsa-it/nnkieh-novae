"use client";

import * as React from "react";
import { ImageIcon } from "lucide-react";
import { stripMarkdownImages } from "@/lib/markdown-images";
import { renderMarkdown } from "@/lib/render-markdown";
import { useResolvedMarkdown } from "@/hooks/use-resolved-markdown";
import type { MarkdownImageRecord } from "@/types";
import {
  ImageLightbox,
  ImagePreviewGrid,
  ImagePreviewTile,
} from "@/components/ui/image-preview";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function ContentRenderer({
  className,
  content,
  fallbackAlt,
  revealText = false,
}: {
  className?: string;
  content: string;
  fallbackAlt: string;
  revealText?: boolean;
}) {
  const [selected, setSelected] = React.useState<MarkdownImageRecord | null>(
    null,
  );
  const { expiresAtByUploadId, images, refresh, resolvedContent } =
    useResolvedMarkdown(content);
  const text = stripMarkdownImages(resolvedContent);
  const html = React.useMemo(() => renderMarkdown(text), [text]);

  const openImage = React.useCallback(
    async (image: MarkdownImageRecord) => {
      if (
        image.uploadId &&
        (expiresAtByUploadId[image.uploadId] ?? 0) <= Date.now() + 60_000
      ) {
        await refresh(image.uploadId).catch(() => undefined);
      }
      setSelected(image);
    },
    [expiresAtByUploadId, refresh],
  );

  return (
    <div className={cn("space-y-4", className)}>
      {images.length > 0 ? (
        <ImagePreviewGrid className="grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]">
          {images.map((image) => (
            <ImagePreviewTile
              alt={image.alt || fallbackAlt}
              disabled={Boolean(image.uploadId && !image.isUploadResolved)}
              height={image.height}
              key={image.uploadId ?? image.src}
              onOpen={() => void openImage(image)}
              placeholder={
                image.resolveError ? (
                  <ImageIcon className="size-5" />
                ) : (
                  <LoadingSpinner className="t-wait-indicator size-5" />
                )
              }
              src={image.src}
              width={image.width}
            />
          ))}
        </ImagePreviewGrid>
      ) : null}
      {text ? revealText ? (
        <SkeletonReveal
          as="div"
          skeleton={
            <div className="space-y-3 py-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          }
        >
          <div
            className="markdown-body break-words text-base leading-7 text-foreground/84"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </SkeletonReveal>
      ) : (
        <div
          className="markdown-body break-words text-base leading-7 text-foreground/84"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
      <ImageLightbox
        alt={selected?.alt || fallbackAlt}
        height={selected?.height}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        open={Boolean(selected)}
        src={selected ? selected.fullSrc || selected.src : undefined}
        width={selected?.width}
      />
    </div>
  );
}
