"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowBendUpLeft, CaretDown, Trash } from "@phosphor-icons/react/ssr";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { usePersonName } from "@/features/content/person";
import type { DiscussionCommentRecord, UserPublicProfile } from "@/types";
import { formatRelativeTime } from "@/lib/format";
import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/feedback";
import { Tooltip } from "@/ui/popover";
import { Markdown } from "./markdown";

function CommentRow({ comment, compact = false, currentUid, onDelete, onReply, profile }: {
  comment: DiscussionCommentRecord;
  compact?: boolean;
  currentUid?: string;
  onDelete: (commentId: string) => Promise<void>;
  onReply: () => void;
  profile?: UserPublicProfile;
}) {
  const { t } = useI18n();
  const personName = usePersonName();
  const [deleting, setDeleting] = React.useState(false);
  const remove = async () => {
    setDeleting(true);
    try {
      await onDelete(comment.id);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.deleteFailed"));
      setDeleting(false);
    }
  };
  return (
    <article className="flex items-start gap-3" data-comment-id={comment.id}>
      {profile ? <Avatar className={compact ? "size-7" : "size-9"} name={personName(profile.displayName)} src={profile.photoUrl} /> : <Skeleton className={cn("shrink-0 rounded-full", compact ? "size-7" : "size-9")} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {profile ? <span className="truncate text-[0.9375rem] font-semibold">{personName(profile.displayName)}</span> : <Skeleton className="h-4 w-16" />}
          <span className="shrink-0 text-xs text-ink-faint">{formatRelativeTime(comment.created_at)}</span>
        </div>
        <Markdown className="mt-1" content={comment.content} fallbackAlt={t("comments.commentAttachmentPreview")} plainText />
        <div className="-ml-2 mt-1 flex items-center gap-1">
          <Tooltip label={t("ui.discussion.reply")}>
            <Button aria-label={t("ui.discussion.reply")} onClick={onReply} size="icon-sm" variant="ghost"><ArrowBendUpLeft /></Button>
          </Tooltip>
          {currentUid === comment.author_uid ? (
            <Tooltip label={t("ui.common.delete")}>
              <Button aria-label={t("ui.common.delete")} onClick={() => void remove()} size="icon-sm" status={deleting ? "loading" : "idle"} variant="ghost">
                {deleting ? null : <Trash />}
              </Button>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** A comment and, folded beneath it, the replies to it. */
export function CommentThread({ comment, currentUid, onDelete, onReply, profiles, replyActive }: {
  comment: DiscussionCommentRecord;
  currentUid?: string;
  onDelete: (commentId: string) => Promise<void>;
  onReply: (comment: DiscussionCommentRecord, parentCommentId: string) => void;
  profiles: Record<string, UserPublicProfile>;
  replyActive: boolean;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = React.useState(false);
  // Replying to a thread opens it, so the new reply lands where it can be seen.
  if (replyActive && !expanded) setExpanded(true);

  return (
    <div className="grid gap-2 px-5 py-4">
      <CommentRow comment={comment} currentUid={currentUid} onDelete={onDelete} onReply={() => onReply(comment, comment.id)} profile={profiles[comment.author_uid]} />
      {comment.replies.length > 0 ? (
        <div className="ml-12 grid gap-2">
          <button
            aria-expanded={expanded}
            className="inline-flex h-8 items-center gap-2 justify-self-start rounded-full px-2 text-sm font-medium text-ink-muted outline-none transition-[background-color,color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            <CaretDown className={cn("size-3.5 transition-transform duration-[var(--motion-control)] ease-[var(--ease-move)]", expanded && "rotate-180")} weight="bold" />
            {expanded ? t("ui.discussion.hideReplies") : t("ui.discussion.showReplies", { count: comment.replies.length })}
          </button>
          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="grid gap-4 overflow-hidden"
                exit={{ height: 0, opacity: 0, transition: timing("controlExit", "depart") }}
                initial={{ height: 0, opacity: 0 }}
                transition={timing("control")}
              >
                {comment.replies.map((reply) => (
                  <CommentRow
                    comment={reply}
                    compact
                    currentUid={currentUid}
                    key={reply.id}
                    onDelete={onDelete}
                    onReply={() => onReply(reply, comment.id)}
                    profile={profiles[reply.author_uid]}
                  />
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
}
