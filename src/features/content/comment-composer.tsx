"use client";

import { ArrowUp, ImageSquare } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { INPUT_LIMITS } from "@/constants/input-limits";
import { cn } from "@/lib/utils";
import type { useImageAttachments } from "@/hooks/use-image-attachments";
import { useSession } from "@/hooks/use-session";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/popover";
import { AttachmentGrid, useImagePicker } from "./attachments";

/** One line that grows: what you are saying, a photo or two, and send. */
export function CommentComposer({ busy, content, draftStatus, feedbackState = "idle", images, onChange, onSubmit, reply = false }: {
  busy: boolean;
  content: string;
  draftStatus?: "restored" | "saved" | "unavailable";
  feedbackState?: "idle" | "loading" | "success";
  images: ReturnType<typeof useImageAttachments>;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  reply?: boolean;
}) {
  const { t } = useI18n();
  const session = useSession();
  const picker = useImagePicker((files) => void images.pick(files));
  const hasContent = Boolean(content.trim()) || images.images.length > 0;
  const canSubmit = hasContent && images.withinLimit && !busy;
  const name = session.user?.displayName || session.user?.email || "";
  const submitLabel = t(reply ? "ui.discussion.reply" : "ui.discussion.submit");
  const over = content.length > INPUT_LIMITS.comment;

  return (
    <div className="grid gap-2" data-update-defer={content.length > 0 || images.images.length > 0 || busy ? "true" : undefined}>
      <AttachmentGrid attachments={images.images} className="px-2" compact onRemove={images.remove} uploading={busy} />
      <div className="flex items-end gap-2">
        <Avatar className="mb-0.5 size-9" name={name} src={session.customPhotoUrl} />
        <textarea
          aria-label={t(reply ? "ui.discussion.replyInput" : "ui.discussion.commentInput")}
          autoFocus={reply}
          className="field-sizing-content max-h-40 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[0.9375rem] leading-relaxed text-ink outline-none placeholder:text-ink-faint"
          maxLength={INPUT_LIMITS.comment}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (!event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 && (event.metaKey || event.ctrlKey) && event.key === "Enter" && canSubmit) {
              event.preventDefault();
              void onSubmit();
            }
          }}
          placeholder={t(reply ? "ui.discussion.replyPlaceholder" : "ui.discussion.commentPlaceholder")}
          rows={1}
          value={content}
        />
        {images.maxImages > 0 ? (
          <>
            {picker.input}
            <Tooltip label={t("comments.imageLimit", { count: images.maxImages })}>
              <Button aria-label={t("comments.addImage")} disabled={busy || images.images.length >= images.maxImages} onClick={picker.open} size="icon-sm" variant="ghost">
                <ImageSquare className="size-5" />
              </Button>
            </Tooltip>
          </>
        ) : null}
        <Tooltip label={submitLabel}>
          <Button aria-label={submitLabel} disabled={!canSubmit} onClick={() => void onSubmit()} size="icon-sm" status={busy ? (feedbackState === "success" ? "success" : "loading") : "idle"} variant="primary">
            {busy ? null : <ArrowUp weight="bold" />}
          </Button>
        </Tooltip>
      </div>
      {content.length > 0 ? (
        <div className="flex items-center justify-between gap-3 px-2 text-xs">
          {draftStatus && draftStatus !== "saved" ? (
            <span className="text-ink-faint" role="status">{t(draftStatus === "restored" ? "comments.draftRestored" : "comments.draftUnavailable")}</span>
          ) : null}
          <span className={cn("ml-auto tabular-nums", over ? "font-medium text-danger" : "text-ink-faint")}>{content.length} / {INPUT_LIMITS.comment}</span>
        </div>
      ) : null}
      <span className="sr-only">{t("ui.discussion.submitShortcut")}</span>
    </div>
  );
}
