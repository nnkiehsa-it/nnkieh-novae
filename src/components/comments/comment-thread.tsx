"use client";

import * as React from "react";
import { ChevronDown, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { t as translate } from "@/i18n";
import type { DiscussionCommentRecord, UserPublicProfile } from "@/types";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

export function CommentThread({
  comment,
  currentUid,
  onDelete,
  onReply,
  profile,
  replyActive,
  replyProfiles,
}: {
  comment: DiscussionCommentRecord;
  currentUid?: string;
  onDelete: (commentId: string) => Promise<void>;
  onReply: (comment: DiscussionCommentRecord, parentCommentId: string) => void;
  profile?: UserPublicProfile;
  replyActive: boolean;
  replyProfiles: Record<string, UserPublicProfile>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => {
    if (replyActive) setExpanded(true);
  }, [replyActive]);

  return (
    <div className="transition-colors hover:bg-muted/20">
      <CommentRow comment={comment} currentUid={currentUid} onDelete={onDelete} onReply={() => onReply(comment, comment.id)} profile={profile} />
      {comment.replies.length > 0 ? (
        <div className="relative ml-4 border-l border-border/80 pb-2 pl-7 sm:ml-5 sm:pl-9">
          <button
            aria-expanded={expanded}
            className="mb-1 inline-flex min-h-8 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            <span className="grid size-5 place-items-center rounded-full bg-foreground text-background">
              <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
            </span>
            {expanded
              ? translate("ui.discussion.hideReplies")
              : translate("ui.discussion.showReplies", { count: comment.replies.length })}
          </button>
          {expanded ? (
            <div className="t-panel-reveal space-y-0.5">
              {comment.replies.map((reply) => (
                <CommentRow
                  comment={reply}
                  compact
                  currentUid={currentUid}
                  key={reply.id}
                  onDelete={onDelete}
                  onReply={() => onReply(reply, comment.id)}
                  profile={replyProfiles[reply.author_uid]}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CommentRow({
  comment,
  compact = false,
  currentUid,
  onDelete,
  onReply,
  profile,
}: {
  comment: DiscussionCommentRecord;
  compact?: boolean;
  currentUid?: string;
  onDelete: (commentId: string) => Promise<void>;
  onReply: () => void;
  profile?: UserPublicProfile;
}) {
  const deleteFeedback = useActionFeedback();
  return (
    <article className={cn("px-5 py-4 sm:px-7", compact && "px-0 py-3")}>
      <div className="flex items-start gap-3">
        {profile ? (
          <Avatar className={compact ? "size-7" : "size-9"}>
            <AvatarImage alt={profile.displayName} src={profile.photoUrl ?? undefined} />
            <AvatarFallback>{profile.displayName.slice(0, 1)}</AvatarFallback>
          </Avatar>
        ) : <Skeleton className={cn("shrink-0 rounded-full", compact ? "size-7" : "size-9")} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {profile ? (
              <p className="truncate text-[0.9375rem] font-semibold">{profile.displayName}</p>
            ) : <Skeleton className="h-4 w-16 shrink-0" />}
            <p className="shrink-0 text-[0.8125rem] text-muted-foreground">{formatRelativeTime(comment.created_at)}</p>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-[0.9375rem] leading-6 text-foreground/88">{comment.content}</p>
          <div className="mt-1.5 flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button aria-label={translate("ui.discussion.reply")} onClick={onReply} size="icon-xs" variant="ghost">
                  <Reply />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{translate("ui.discussion.reply")}</TooltipContent>
            </Tooltip>
            {currentUid === comment.author_uid ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={translate("ui.common.delete")}
                    disabled={deleteFeedback.busy}
                    onClick={() => void deleteFeedback.run(() => onDelete(comment.id)).catch((error) =>
                      toast.error(error instanceof Error ? error.message : translate("ui.common.deleteFailed")),
                    )}
                    size="icon-xs"
                    variant="ghost"
                  >
                    {deleteFeedback.busy ? (
                      <ActionFeedbackIcon className="[&>svg]:size-4" size="sm" state={deleteFeedback.state === "success" ? "success" : "loading"} />
                    ) : <Trash2 />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{translate("ui.common.delete")}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
