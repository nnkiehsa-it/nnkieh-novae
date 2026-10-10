"use client";

import * as React from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Block, BlockTitle } from "framework7-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  ImageLightbox,
  ImagePreviewGrid,
  ImagePreviewTile,
} from "@/components/ui/image-preview";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ComposerMediaAttachments({
  attachments,
  className,
  onPickImages,
  onRemoveImage,
  uploading,
  maxImages,
  compact = false,
}: {
  attachments: Array<{ height: number; previewUrl: string; width: number }>;
  className?: string;
  onPickImages: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  uploading: boolean;
  maxImages: number;
  compact?: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const [opened, setOpened] = React.useState<number | null>(null);
  const headingId = React.useId();
  // An attachment removed while it is open leaves nothing to look at.
  const open = opened !== null ? attachments[opened] : undefined;

  return (
    <section
      aria-label={compact ? t("markdown.imageAttachments") : undefined}
      aria-labelledby={compact ? undefined : headingId}
      aria-busy={uploading}
      className={cn(
        compact ? "grid h-fit gap-2 px-2" : "min-w-0",
        className,
      )}
    >
      {!compact ? <BlockTitle className="mt-0 whitespace-normal">
          <h3 id={headingId}>
              {t("markdown.imageAttachments")} · {attachments.length} / {maxImages}
          </h3>
      </BlockTitle> : null}
      <Block strong={!compact} inset={!compact} className={cn("m-0 grid gap-3", compact && "p-0")}>
        {!compact && maxImages > 0 ? <Button
          className="shrink-0"
          disabled={uploading || attachments.length >= maxImages}
          onClick={() => fileRef.current?.click()}
          size="sm"
          type="button"
          variant="secondary"
        >
          {uploading ? <LoadingSpinner /> : <ImagePlus />}
          {uploading ? t("markdown.processingImages") : t("ui.composer.addImage")}
        </Button> : null}
      {!compact ? <input
        ref={fileRef}
        accept="image/*"
        className="sr-only"
        multiple
        onChange={(event) => {
          onPickImages(event.target.files);
          event.target.value = "";
        }}
        type="file"
      /> : null}
      {attachments.length > maxImages ? <p className="text-xs text-destructive" role="alert">{t("upload.imageLimit", { count: maxImages })}</p> : null}
      {attachments.length > 0 ? (
        <ImagePreviewGrid className={compact ? "grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] max-h-40 overflow-y-auto" : undefined}>
          {attachments.map((image, index) => (
            <ImagePreviewTile
              actions={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label={t("ui.common.delete")}
                      className="absolute right-1.5 top-1.5"
                      disabled={uploading}
                      onClick={() => onRemoveImage(index)}
                      size="icon-xs"
                      type="button"
                      variant="destructive"
                    >
                      <Trash2 />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("ui.common.delete")}</TooltipContent>
                </Tooltip>
              }
              alt={t("ui.composer.attachmentPreview")}
              height={image.height}
              key={image.previewUrl}
              onOpen={() => setOpened(index)}
              src={image.previewUrl}
              width={image.width}
            />
          ))}
        </ImagePreviewGrid>
      ) : null}
      </Block>
      <ImageLightbox
        alt={t("ui.composer.attachmentPreview")}
        height={open?.height}
        onOpenChange={(next) => { if (!next) setOpened(null); }}
        open={Boolean(open)}
        src={open?.previewUrl}
        width={open?.width}
      />
    </section>
  );
}
