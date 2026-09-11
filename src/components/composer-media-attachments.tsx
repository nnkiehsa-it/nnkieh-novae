"use client";

import * as React from "react";
import { ImagePlus, Trash2 } from "lucide-react";
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
}: {
  attachments: Array<{ height: number; previewUrl: string; width: number }>;
  className?: string;
  onPickImages: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  uploading: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const [opened, setOpened] = React.useState<number | null>(null);
  const headingId = "composer-images-heading";
  // An attachment removed while it is open leaves nothing to look at.
  const open = opened !== null ? attachments[opened] : undefined;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "grid h-fit gap-3 rounded-xl border border-dashed bg-muted/20 p-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium" id={headingId}>
            {t("markdown.imageAttachments")}
          </h3>
        </div>
        <Button
          className="shrink-0"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          {uploading ? <LoadingSpinner /> : <ImagePlus />}
          {uploading ? t("markdown.processingImages") : t("ui.composer.addImage")}
        </Button>
      </div>
      <input
        ref={fileRef}
        accept="image/*"
        className="sr-only"
        multiple
        onChange={(event) => {
          onPickImages(event.target.files);
          event.target.value = "";
        }}
        type="file"
      />
      {attachments.length > 0 ? (
        <ImagePreviewGrid>
          {attachments.map((image, index) => (
            <ImagePreviewTile
              actions={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label={t("ui.common.delete")}
                      className="absolute right-1.5 top-1.5 bg-card/88 backdrop-blur-sm"
                      onClick={() => onRemoveImage(index)}
                      size="icon-xs"
                      type="button"
                      variant="outline"
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
