"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { Messagebar } from "framework7-react";
import { Button } from "@/components/ui/button";
import { useFramework7Control } from "@/components/ui/use-framework7-control";
import { ArrowUp, ImagePlus } from "lucide-react";
import type { useImageAttachments } from "@/hooks/use-image-attachments";
import { ComposerMediaAttachments } from "@/components/composer-media-attachments";
import { t as translate } from "@/i18n";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { INPUT_LIMITS } from "@/constants/input-limits";
import { cn } from "@/lib/utils";

export function CommentComposer({
  busy,
  images,
  content,
  draftStatus,
  feedbackState = "idle",
  onChange,
  onSubmit,
  reply = false,
}: {
  busy: boolean;
  images: ReturnType<typeof useImageAttachments>;
  content: string;
  draftStatus?: "restored" | "saved" | "unavailable";
  feedbackState?: "idle" | "loading" | "success";
  onChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  reply?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const hasContent = Boolean(content.trim()) || images.images.length > 0;
  const canSubmit = hasContent && images.withinLimit && !busy;
  const submitLabel = reply
    ? translate("ui.discussion.reply")
    : translate("ui.discussion.submit");
  const messagebarRef = useFramework7Control<HTMLTextAreaElement>(
    undefined,
    "textarea",
    {
      "aria-label": reply
        ? translate("ui.discussion.replyInput")
        : translate("ui.discussion.commentInput"),
      maxlength: INPUT_LIMITS.comment,
    },
  );
  useEffect(() => {
    const textarea = messagebarRef.current.el!.querySelector("textarea")!;
    if (reply) textarea.focus();
    const onKey = (event: KeyboardEvent) => {
      if (
        !event.isComposing &&
        event.keyCode !== 229 &&
        (event.metaKey || event.ctrlKey) &&
        event.key === "Enter" &&
        canSubmit
      ) {
        event.preventDefault();
        void onSubmit();
      }
    };
    textarea.addEventListener("keydown", onKey);
    return () => textarea.removeEventListener("keydown", onKey);
  }, [canSubmit, messagebarRef, onSubmit, reply]);

  return (
    <div
      className="grid gap-2"
      data-update-defer={
        content.length > 0 || images.images.length > 0 || busy
          ? "true"
          : undefined
      }
    >
      {images.images.length > 0 ? (
        <ComposerMediaAttachments
          compact
          attachments={images.images}
          maxImages={images.maxImages}
          uploading={busy}
          onPickImages={(files) => void images.pick(files)}
          onRemoveImage={images.remove}
        />
      ) : null}
      <Messagebar
        ref={
          messagebarRef as NonNullable<ComponentProps<typeof Messagebar>["ref"]>
        }
        resizePage={false}
        maxHeight={160}
        value={content}
        onInput={(event) => onChange(event.target.value)}
        placeholder={
          reply
            ? translate("ui.discussion.replyPlaceholder")
            : translate("ui.discussion.commentPlaceholder")
        }
      >
        {images.maxImages > 0 ? (
          <div slot="inner-start">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => {
                void images.pick(event.target.files);
                event.target.value = "";
              }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={translate("comments.addImage")}
                  className="link"
                  disabled={busy || images.images.length >= images.maxImages}
                  onClick={() => fileRef.current?.click()}
                  type="button"
                  variant="ghost"
                  size="icon"
                >
                  <ImagePlus className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {translate("comments.imageLimit", { count: images.maxImages })}
              </TooltipContent>
            </Tooltip>
          </div>
        ) : null}
        <div slot="inner-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={submitLabel}
                className="link"
                disabled={!canSubmit}
                onClick={() => void onSubmit()}
                type="button"
                variant="ghost"
                size="icon"
              >
                {busy ? (
                  <ActionFeedbackIcon
                    className="[&>svg]:size-4"
                    size="sm"
                    state={feedbackState === "success" ? "success" : "loading"}
                  />
                ) : (
                  <ArrowUp className="size-5" strokeWidth={2.25} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{submitLabel}</TooltipContent>
          </Tooltip>
        </div>
      </Messagebar>
      {content.length > 0 ? (
        <div className="flex items-start justify-between gap-3 px-3">
          {draftStatus && draftStatus !== "saved" ? (
            <span
              className="min-w-0 text-[11px] text-muted-foreground"
              role="status"
            >
              {translate(
                draftStatus === "restored"
                  ? "comments.draftRestored"
                  : "comments.draftUnavailable",
              )}
            </span>
          ) : null}
          <span
            className={cn(
              "ml-auto shrink-0 text-[11px] tabular-nums",
              content.length > INPUT_LIMITS.comment
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
          >
            {content.length} / {INPUT_LIMITS.comment}
          </span>
        </div>
      ) : null}
      <span className="sr-only">
        {translate("ui.discussion.submitShortcut")}
      </span>
    </div>
  );
}
