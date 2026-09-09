"use client";

import * as React from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { DecodedImage } from "@/components/ui/decoded-image";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ComposerMediaAttachments({
  attachments,
  onPickImages,
  onRemoveImage,
  uploading,
}: {
  attachments: Array<{ height: number; previewUrl: string; width: number }>;
  onPickImages: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  uploading: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const headingId = "composer-images-heading";

  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-3 rounded-xl border border-dashed bg-muted/20 p-3"
    >
      <div className="flex items-center justify-between gap-3">
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
        <div className="flex snap-x gap-2 overflow-x-auto pb-1">
          {attachments.map((image, index) => (
            <div
              className="group relative aspect-[4/3] w-32 shrink-0 snap-start overflow-hidden rounded-xl border bg-muted"
              key={image.previewUrl}
            >
              <DecodedImage
                alt={t("ui.composer.attachmentPreview")}
                className="size-full object-cover"
                containerClassName="size-full"
                height={image.height}
                src={image.previewUrl}
                width={image.width}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t("ui.common.delete")}
                    className={cn("absolute right-1.5 top-1.5 bg-card/88 backdrop-blur-sm")}
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
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
