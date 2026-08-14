"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import * as React from "react";
import { ChevronDown, LoaderCircle, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import type { CommentSortOption, DiscussionCommentRecord } from "@/types";
import { useDiscussionProfiles } from "@/hooks/use-public-profiles";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import { CommentComposer } from "@/components/comments/comment-composer";
import { CommentThread } from "@/components/comments/comment-thread";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { ResizableCard } from "@/components/ui/resizable-card";

interface ReplyTarget {
  authorUid: string;
  content: string;
  parentCommentId: string;
}

function getReplyExcerpt(content: string) {
  const characters = Array.from(content.trim().replace(/\s+/gu, " "));
  const excerpt = characters.slice(0, 20).join("");
  return characters.length > 20 ? `${excerpt}…` : excerpt;
}

export function Discussion({
  comments,
  enabled = true,
  hasMore = false,
  loading,
  loadingMore = false,
  onCreate,
  onDelete,
  onLoadMore,
  onSortChange,
  sort,
}: {
  comments: DiscussionCommentRecord[];
  enabled?: boolean;
  hasMore?: boolean;
  loading: boolean;
  loadingMore?: boolean;
  onCreate: (content: string, parentCommentId: string | null) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onLoadMore?: () => Promise<void>;
  onSortChange: (sort: CommentSortOption) => void;
  sort: CommentSortOption;
}) {
  useLocaleSubscription();
  const session = useSession();
  const [commentDraft, setCommentDraft] = React.useState("");
  const [replyDraft, setReplyDraft] = React.useState("");
  const [replyTarget, setReplyTarget] = React.useState<ReplyTarget | null>(null);
  const feedback = useActionFeedback();
  const profiles = useDiscussionProfiles(comments);

  async function submit(reply = false) {
    const value = (reply ? replyDraft : commentDraft).trim();
    if (!value || feedback.busy) return;
    try {
      await feedback.run(() => onCreate(value, reply ? replyTarget?.parentCommentId ?? null : null));
      if (reply) {
        setReplyDraft("");
        setReplyTarget(null);
      } else {
        setCommentDraft("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : translate("ui.discussion.submitFailed"));
    }
  }

  return (
    <section
      className={enabled ? "pb-[calc(9rem+var(--safe-bottom))]" : undefined}
      aria-labelledby="discussion-title"
    >
      <ResizableCard className="gap-0 overflow-hidden py-0">
        <div className="flex items-center gap-2 border-b px-5 py-4 sm:px-7">
          <MessageCircle className="size-4 text-muted-foreground" />
          <h2 className="font-semibold" id="discussion-title">{translate("ui.discussion.title")}</h2>
          <span className="text-sm tabular-nums text-muted-foreground">{comments.length}</span>
          <Select onValueChange={(value) => onSortChange(value as CommentSortOption)} value={sort}>
            <SelectTrigger
              aria-label={translate("ui.discussion.sort")}
              className="ml-auto h-8 w-auto min-w-28 gap-1.5 px-2.5"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="newest">{translate("ui.discussion.newest")}</SelectItem>
              <SelectItem value="oldest">{translate("ui.discussion.oldest")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!enabled ? (
          <p className="bg-muted/20 px-5 py-4 text-sm text-muted-foreground sm:px-7">{translate("ui.discussion.disabled")}</p>
        ) : null}

        {loading ? (
          <div className="space-y-3 px-5 py-4 sm:px-7" aria-label={translate("ui.common.loadingMore")}>
            <div className="t-skeleton h-28 rounded-xl bg-muted" />
            <div className="t-skeleton h-24 rounded-xl bg-muted" />
          </div>
        ) : comments.length > 0 ? (
          <StaggerList className="divide-y">
            {comments.map((comment) => (
              <StaggerItem key={comment.id}>
                <CommentThread
                  comment={comment}
                  currentUid={session.user?.uid}
                  onDelete={onDelete}
                  onReply={(target, parentCommentId) => {
                    setReplyDraft("");
                    setReplyTarget({
                      authorUid: target.author_uid,
                      content: target.content,
                      parentCommentId,
                    });
                  }}
                  profile={profiles[comment.author_uid]}
                  replyActive={replyTarget?.parentCommentId === comment.id}
                  replyProfiles={profiles}
                />
              </StaggerItem>
            ))}
          </StaggerList>
        ) : null}

        {hasMore && onLoadMore ? (
          <div className="flex justify-center border-t px-5 py-4 sm:px-7">
            <Button disabled={loadingMore} onClick={() => void onLoadMore()} size="sm" variant="outline">
              {loadingMore ? <LoaderCircle className="t-spinner" /> : <ChevronDown />}
              {loadingMore ? translate("ui.common.loadingMore") : translate("ui.discussion.loadMore")}
            </Button>
          </div>
        ) : null}
      </ResizableCard>

      {enabled ? (
        <div className="discussion-composer-dock">
          <div className="mx-auto w-full max-w-2xl rounded-[2rem] border bg-background p-1.5 shadow-[var(--shadow-floating)] focus-within:border-ring/45 focus-within:ring-2 focus-within:ring-ring/20">
            {replyTarget ? (
              <div className="mb-1 flex items-start gap-3 border-b px-2 pb-2 pt-1">
                <div className="min-w-0 flex-1 text-xs leading-5">
                  <p className="font-medium text-foreground">
                    {translate("ui.discussion.replying", {
                      name: profiles[replyTarget.authorUid]?.displayName || translate("ui.common.schoolMember"),
                    })}
                  </p>
                  <p className="truncate text-muted-foreground">{getReplyExcerpt(replyTarget.content)}</p>
                </div>
                <Button
                  aria-label={translate("ui.common.cancel")}
                  className="shrink-0"
                  onClick={() => {
                    setReplyDraft("");
                    setReplyTarget(null);
                  }}
                  size="icon-xs"
                  variant="ghost"
                >
                  <X />
                </Button>
              </div>
            ) : null}
            <CommentComposer
              busy={feedback.busy}
              content={replyTarget ? replyDraft : commentDraft}
              feedbackState={feedback.state}
              onChange={replyTarget ? setReplyDraft : setCommentDraft}
              onSubmit={() => submit(Boolean(replyTarget))}
              reply={Boolean(replyTarget)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
