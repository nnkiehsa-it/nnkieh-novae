"use client";

import * as React from "react";
import { Image as ImageIcon } from "@phosphor-icons/react/ssr";
import type { MarkdownImageRecord } from "@/types";
import { stripMarkdownImages } from "@/lib/markdown-images";
import { renderMarkdown } from "@/lib/render-markdown";
import { cn } from "@/lib/utils";
import { useResolvedMarkdown } from "@/hooks/use-resolved-markdown";
import { ImageGrid, ImageLightbox, ImageTile } from "@/ui/image";

/**
 * A record's or a comment's body: its images as tiles above, its text below,
 * as rendered markdown or (for comments) plain wrapped text. Signed image links
 * are refreshed on open when they are about to expire.
 */
/** A signed link that lapses within the minute is renewed before it is opened. */
function expiresSoon(expiresAt: number | undefined) {
  return (expiresAt ?? 0) <= Date.now() + 60_000;
}

export function Markdown({ className, content, fallbackAlt, plainText = false }: {
  className?: string;
  content: string;
  fallbackAlt: string;
  plainText?: boolean;
}) {
  const [selected, setSelected] = React.useState<MarkdownImageRecord | null>(null);
  const { images, references, refresh, resolvedContent } = useResolvedMarkdown(content);
  const text = stripMarkdownImages(resolvedContent);
  const html = React.useMemo(() => (plainText ? "" : renderMarkdown(text)), [plainText, text]);

  const openImage = async (image: MarkdownImageRecord) => {
    if (image.uploadId && expiresSoon(references[image.uploadId]?.expiresAtMs)) {
      const renewed = await refresh(image.uploadId).catch(() => null);
      if (!renewed) return;
      setSelected({ ...image, fullSrc: renewed.fullUrl, src: renewed.thumbnailUrl });
      return;
    }
    setSelected(image);
  };

  return (
    <div className={cn("grid gap-4", className)}>
      {images.length > 0 ? (
        <ImageGrid className="grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]">
          {images.map((image) => (
            <ImageTile
              alt={image.alt || fallbackAlt}
              disabled={Boolean(image.uploadId && !image.isUploadResolved)}
              height={image.height}
              key={image.uploadId ?? image.src}
              onOpen={() => void openImage(image)}
              placeholder={image.resolveError ? <ImageIcon className="size-5" /> : <span aria-hidden className="skeleton absolute inset-0 bg-surface-raised" />}
              src={image.src}
              width={image.width}
            />
          ))}
        </ImageGrid>
      ) : null}
      {text ? (
        plainText ? (
          <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-ink">{text}</p>
        ) : (
          <div className="markdown-body break-words text-base leading-7 text-ink" dangerouslySetInnerHTML={{ __html: html }} />
        )
      ) : null}
      <ImageLightbox
        alt={selected?.alt || fallbackAlt}
        height={selected?.height}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        open={Boolean(selected)}
        src={selected ? selected.fullSrc || selected.src : undefined}
        width={selected?.width}
      />
    </div>
  );
}
