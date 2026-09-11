"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComposerMediaAttachments } from "@/components/composer-media-attachments";
import { MarkdownEditor } from "@/components/markdown-editor";
import { cn } from "@/lib/utils";

import { INPUT_LIMITS } from "@/constants/input-limits";

/**
 * The composer's own fields. `pending` renders the identical structure with the
 * editor stood down to its loading box, so the route skeleton is this component
 * rather than a hand-built imitation of it and the two states occupy the same
 * geometry down to the character counters.
 */
export function ComposerField({
  attachments,
  attachmentsUploading,
  content,
  contentLabel,
  onContentChange,
  onPickImages,
  onRemoveImage,
  onTitleChange,
  pending = false,
  placeholder,
  title,
  titleLabel,
  titlePlaceholder,
}: {
  attachments: Array<{ height: number; previewUrl: string; width: number }>;
  attachmentsUploading: boolean;
  content: string;
  contentLabel: string;
  onContentChange: (value: string) => void;
  onPickImages: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  onTitleChange: (value: string) => void;
  pending?: boolean;
  placeholder: string;
  title: string;
  titleLabel: string;
  titlePlaceholder: string;
}) {
  useLocaleSubscription();

  return (
    <div className="grid min-w-0 gap-5">
      <div className="grid min-w-0 gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="composer-title">{titleLabel}</Label>
          <span
            className={cn(
              "text-xs tabular-nums",
              title.length > INPUT_LIMITS.title
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
          >
            {title.length} / {INPUT_LIMITS.title}
          </span>
        </div>
        <Input
          disabled={pending}
          id="composer-title"
          maxLength={INPUT_LIMITS.title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={titlePlaceholder}
          value={title}
        />
      </div>
      <div className="grid min-w-0 gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="composer-content">{contentLabel}</Label>
          <span
            className={cn(
              "text-xs tabular-nums",
              content.length > INPUT_LIMITS.content
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
            id="composer-content-count"
          >
            {content.length} / {INPUT_LIMITS.content}
          </span>
        </div>
        {pending ? (
          <div aria-hidden className="novae-markdown-editor is-loading" />
        ) : (
          <MarkdownEditor
            ariaDescribedBy="composer-content-count"
            ariaLabel={contentLabel}
            content={content}
            id="composer-content"
            maxLength={INPUT_LIMITS.content}
            onChange={onContentChange}
            onPickImages={onPickImages}
            placeholder={placeholder}
          />
        )}
        {content.length > INPUT_LIMITS.content ? (
          <p className="text-xs leading-5 text-destructive" role="alert">
            {translate("markdown.contentTooLong", { count: INPUT_LIMITS.content })}
          </p>
        ) : null}
      </div>
      <ComposerMediaAttachments
        attachments={attachments}
        onPickImages={onPickImages}
        onRemoveImage={onRemoveImage}
        uploading={attachmentsUploading}
      />
    </div>
  );
}
