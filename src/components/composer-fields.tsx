"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { Block, BlockTitle } from "framework7-react";
import { ListSection } from "@/components/ui/list";
import { ListInputRow } from "@/components/ui/list-controls";
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
  maxImages = 0,
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
  maxImages?: number;
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
    <div className={cn("grid min-w-0 items-start gap-5", (maxImages > 0 || attachments.length > 0) && "lg:grid-cols-[minmax(0,1fr)_17rem]")}>
      <div className="grid min-w-0 gap-5">
        <ListSection>
          <ListInputRow
            disabled={pending}
            id="composer-title"
            label={titleLabel}
            maxLength={INPUT_LIMITS.title}
            onChange={onTitleChange}
            placeholder={titlePlaceholder}
            value={title}
            info={<span className="tabular-nums">{title.length} / {INPUT_LIMITS.title}</span>}
          />
        </ListSection>
        <section className="min-w-0">
          <BlockTitle className="mt-0 flex items-center justify-between gap-3">
            <label htmlFor="composer-content">{contentLabel}</label>
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
          </BlockTitle>
          <Block strong inset className="m-0 p-0">
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
              onPickImages={maxImages > 0 ? onPickImages : undefined}
              placeholder={placeholder}
            />
          )}
          {content.length > INPUT_LIMITS.content ? (
            <p className="text-xs leading-5 text-destructive" role="alert">
              {translate("markdown.contentTooLong", { count: INPUT_LIMITS.content })}
            </p>
          ) : null}
          </Block>
        </section>
      </div>
      {maxImages > 0 || attachments.length > 0 ? <ComposerMediaAttachments
        maxImages={maxImages}
        attachments={attachments}
        className="lg:sticky lg:top-4"
        onPickImages={onPickImages}
        onRemoveImage={onRemoveImage}
        uploading={attachmentsUploading}
      /> : null}
    </div>
  );
}
