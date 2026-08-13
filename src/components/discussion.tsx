"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import * as React from "react";
import { ChevronDown, LoaderCircle, MessageCircle } from "lucide-react";
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
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  const feedback = useActionFeedback();
  const profiles = useDiscussionProfiles(comments);

  async function submit(reply = false) {
    const value = (reply ? replyDraft : commentDraft).trim();
    if (!value || feedback.busy) return;
    try {
      await feedback.run(() => onCreate(value, reply ? replyTo : null));
      if (reply) {
        setReplyDraft("");
        setReplyTo(null);
      } else {
        setCommentDraft("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : translate("ui.discussion.submitFailed"));
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="discussion-title">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-muted-foreground" />
        <h2 className="font-semibold" id="discussion-title">{translate("ui.discussion.title")}</h2>
        <span className="text-sm tabular-nums text-muted-foreground">{comments.length}</span>
        <Select onValueChange={(value) => onSortChange(value as CommentSortOption)} value={sort}>
          <SelectTrigger
            aria-label={translate("ui.discussion.sort")}
            className="ml-auto h-8 w-auto min-w-28 gap-1.5 px-2.5 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="newest">{translate("ui.discussion.newest")}</SelectItem>
            <SelectItem value="oldest">{translate("ui.discussion.oldest")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {enabled ? (
        <CommentComposer
          busy={feedback.busy}
          content={commentDraft}
          feedbackState={feedback.state}
          onChange={setCommentDraft}
          onSubmit={() => submit(false)}
        />
      ) : (
        <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">{translate("ui.discussion.disabled")}</p>
      )}

      {loading ? (
        <div className="space-y-3" aria-label={translate("ui.common.loadingMore")}>
          <div className="t-skeleton h-28 rounded-xl bg-muted" />
          <div className="t-skeleton h-24 rounded-xl bg-muted" />
        </div>
      ) : comments.length > 0 ? (
        <StaggerList className="space-y-1">
          {comments.map((comment) => (
            <StaggerItem key={comment.id}>
              <CommentThread
                comment={comment}
                currentUid={session.user?.uid}
                onDelete={onDelete}
                onReply={(commentId) => {
                  setReplyDraft("");
                  setReplyTo(commentId);
                }}
                profile={profiles[comment.author_uid]}
                replyComposer={enabled && replyTo === comment.id ? (
                  <CommentComposer
                    busy={feedback.busy}
                    content={replyDraft}
                    feedbackState={feedback.state}
                    onCancel={() => {
                      setReplyDraft("");
                      setReplyTo(null);
                    }}
                    onChange={setReplyDraft}
                    onSubmit={() => submit(true)}
                    reply
                  />
                ) : null}
                replyProfiles={profiles}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      ) : null}

      {hasMore && onLoadMore ? (
        <div className="flex justify-center pt-1">
          <Button disabled={loadingMore} onClick={() => void onLoadMore()} size="sm" variant="outline">
            {loadingMore ? <LoaderCircle className="t-spinner" /> : <ChevronDown />}
            {loadingMore ? translate("ui.common.loadingMore") : translate("ui.discussion.loadMore")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
