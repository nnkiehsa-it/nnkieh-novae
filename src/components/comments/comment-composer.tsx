"use client";

import { useRef } from "react";
import { ArrowUp, ImagePlus } from "lucide-react";
import type { useImageAttachments } from "@/hooks/use-image-attachments";
import { ComposerMediaAttachments } from "@/components/composer-media-attachments";
import { t as translate } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

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
  const session = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const hasContent = Boolean(content.trim()) || images.images.length > 0;
  const canSubmit = hasContent && images.withinLimit && !busy;
  const displayName = session.user?.displayName || session.user?.email || "";
  const photoUrl = session.customPhotoUrl || session.user?.photoURL || undefined;
  const submitLabel = reply ? translate("ui.discussion.reply") : translate("ui.discussion.submit");

  return (
    <div className="grid gap-2" data-update-defer={content.length > 0 || images.images.length > 0 || busy ? "true" : undefined}>
      {images.images.length > 0 ? <ComposerMediaAttachments compact attachments={images.images}
        maxImages={images.maxImages} uploading={busy} onPickImages={(files) => void images.pick(files)} onRemoveImage={images.remove} /> : null}
      <div className="flex min-h-10 items-center gap-1 px-1 sm:gap-3">
        <Avatar className="size-8 shrink-0 border bg-background sm:size-10">
          <AvatarImage alt={displayName} src={photoUrl} />
          <AvatarFallback>
            {displayName ? displayName.slice(0, 1) : <Skeleton className="size-full rounded-full" />}
          </AvatarFallback>
        </Avatar>
        <Textarea
          aria-label={reply ? translate("ui.discussion.replyInput") : translate("ui.discussion.commentInput")}
          autoFocus={reply}
          className="max-h-40 min-h-10 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-2.5 shadow-none focus-visible:outline-none focus-visible:ring-0"
          maxLength={INPUT_LIMITS.comment}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (!event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229
              && (event.metaKey || event.ctrlKey) && event.key === "Enter" && canSubmit) {
              event.preventDefault();
              void onSubmit();
            }
          }}
          placeholder={reply ? translate("ui.discussion.replyPlaceholder") : translate("ui.discussion.commentPlaceholder")}
          rows={1}
          value={content}
        />
        {images.maxImages > 0 ? <>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(event) => {
            void images.pick(event.target.files);
            event.target.value = "";
          }} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button aria-label={translate("comments.addImage")} className="size-10 shrink-0 rounded-full"
                disabled={busy || images.images.length >= images.maxImages}
                onClick={() => fileRef.current?.click()} size="icon-lg" type="button" variant="ghost">
                <ImagePlus className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{translate("comments.imageLimit", { count: images.maxImages })}</TooltipContent>
          </Tooltip>
        </> : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={submitLabel}
              className="size-10 min-h-10 min-w-10 shrink-0 rounded-full"
              disabled={!canSubmit}
              onClick={() => void onSubmit()}
              size="icon-lg"
            >
              {busy ? (
                <ActionFeedbackIcon
                  className="[&>svg]:size-4"
                  size="sm"
                  state={feedbackState === "success" ? "success" : "loading"}
                />
              ) : <ArrowUp className="size-5" strokeWidth={2.25} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{submitLabel}</TooltipContent>
        </Tooltip>
      </div>
      {content.length > 0 ? (
        <div className="flex items-start justify-between gap-3 px-3">
          {draftStatus && draftStatus !== "saved" ? (
            <span className="min-w-0 text-[11px] text-muted-foreground" role="status">
              {translate(draftStatus === "restored" ? "comments.draftRestored" : "comments.draftUnavailable")}
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
      <span className="sr-only">{translate("ui.discussion.submitShortcut")}</span>
    </div>
  );
}
