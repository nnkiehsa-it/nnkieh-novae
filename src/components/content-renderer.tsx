"use client";

import * as React from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { ImageIcon, ZoomIn } from "lucide-react";
import { stripMarkdownImages } from "@/lib/markdown-images";
import { useResolvedMarkdown } from "@/hooks/use-resolved-markdown";
import type { MarkdownImageRecord } from "@/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DecodedImage } from "@/components/ui/decoded-image";

marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(content: string) {
  const raw = marked.parse(content, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ["loading", "fetchpriority", "decoding"],
    FORBID_TAGS: ["img"],
  });
}

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
        <div className="flex snap-x gap-2.5 overflow-x-auto pb-1">
          {images.map((image) => (
            <button
              className="group relative aspect-[4/3] w-36 shrink-0 snap-start overflow-hidden rounded-xl border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:w-44"
              disabled={Boolean(image.uploadId && !image.isUploadResolved)}
              key={image.uploadId ?? image.src}
              onClick={() => void openImage(image)}
              type="button"
            >
              {image.src ? (
                <DecodedImage
                  alt={image.alt || fallbackAlt}
                  className="size-full object-cover transition-transform duration-300 ease-[var(--ease-smooth-out)] group-hover:scale-[1.025]"
                  containerClassName="size-full"
                  height={image.height}
                  fetchPriority="low"
                  loading="eager"
                  src={image.src}
                  width={image.width}
                />
              ) : (
                <span className="grid size-full place-items-center text-muted-foreground">
                  {image.resolveError ? (
                    <ImageIcon className="size-5" />
                  ) : (
                    <LoadingSpinner className="size-5" />
                  )}
                </span>
              )}
              <span className="absolute bottom-2 right-2 grid size-7 translate-y-1 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100">
                <ZoomIn className="size-3.5" />
              </span>
            </button>
          ))}
        </div>
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
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-w-[min(92vw,70rem)] border-0 bg-transparent p-0 shadow-none sm:max-w-[min(92vw,70rem)]">
          <DialogTitle className="sr-only">
            {selected?.alt || fallbackAlt}
          </DialogTitle>
          {selected ? (
            <DecodedImage
              alt={selected.alt || fallbackAlt}
              className="max-h-[calc(100svh-3rem)] w-full rounded-xl object-contain"
              containerClassName="min-h-48 w-full place-items-center rounded-xl bg-black/20"
              height={selected.height}
              src={selected.fullSrc || selected.src}
              width={selected.width}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
