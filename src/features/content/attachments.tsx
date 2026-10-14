"use client";

import * as React from "react";
import { ImageSquare, X } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Spinner } from "@/ui/feedback";
import { ImageGrid, ImageLightbox, ImageTile } from "@/ui/image";

interface Attachment {
  height: number;
  previewUrl: string;
  width: number;
}

/** Opens the system picker for images; render the returned input once. */
export function useImagePicker(onPick: (files: FileList | null) => void) {
  const ref = React.useRef<HTMLInputElement>(null);
  const input = (
    <input
      accept="image/*"
      className="sr-only"
      multiple
      onChange={(event) => {
        onPick(event.target.files);
        event.target.value = "";
      }}
      ref={ref}
      tabIndex={-1}
      type="file"
    />
  );
  return { input, open: () => ref.current?.click() };
}

/** Images waiting to be sent with a record or a comment. */
export function AttachmentGrid({ attachments, className, compact = false, onRemove, uploading }: {
  attachments: readonly Attachment[];
  className?: string;
  compact?: boolean;
  onRemove: (index: number) => void;
  uploading: boolean;
}) {
  const { t } = useI18n();
  const [opened, setOpened] = React.useState<number | null>(null);
  // An attachment removed while it is open leaves nothing to look at.
  const open = opened !== null ? attachments[opened] : undefined;
  if (!attachments.length) return null;
  return (
    <>
      <ImageGrid className={cn(compact && "max-h-40 grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] overflow-y-auto", className)}>
        {attachments.map((image, index) => (
          <ImageTile
            actions={
              <Button
                aria-label={t("ui.common.delete")}
                className="absolute right-1 top-1 bg-[var(--scrim)]"
                disabled={uploading}
                onClick={() => onRemove(index)}
                size="icon-sm"
                variant="ghost"
              >
                <X weight="bold" />
              </Button>
            }
            alt={t("ui.composer.attachmentPreview")}
            height={image.height}
            key={image.previewUrl}
            onOpen={() => setOpened(index)}
            src={image.previewUrl}
            width={image.width}
          />
        ))}
      </ImageGrid>
      <ImageLightbox
        alt={t("ui.composer.attachmentPreview")}
        height={open?.height}
        onOpenChange={(next) => { if (!next) setOpened(null); }}
        open={Boolean(open)}
        src={open?.previewUrl}
        width={open?.width}
      />
    </>
  );
}

/** The add-images control with the running count against the limit. */
export function AddImagesButton({ count, maxImages, onPick, uploading }: {
  count: number;
  maxImages: number;
  onPick: (files: FileList | null) => void;
  uploading: boolean;
}) {
  const { t } = useI18n();
  const picker = useImagePicker(onPick);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {picker.input}
      <Button disabled={uploading || count >= maxImages} onClick={picker.open} size="sm">
        {uploading ? <Spinner className="size-4" /> : <ImageSquare />}
        {uploading ? t("markdown.processingImages") : t("ui.composer.addImage")}
      </Button>
      <span className="text-sm tabular-nums text-ink-faint">{count} / {maxImages}</span>
      {count > maxImages ? <span className="text-sm text-danger" role="alert">{t("upload.imageLimit", { count: maxImages })}</span> : null}
    </div>
  );
}
