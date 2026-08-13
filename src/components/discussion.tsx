"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import * as React from "react";
import { LoaderCircle, MessageCircle, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { DiscussionCommentRecord, UserPublicProfile } from "@/types";
import { useDiscussionProfiles } from "@/hooks/use-public-profiles";
import { useSession } from "@/hooks/use-session";
import { formatRelativeTime } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import { CommentComposer } from "@/components/comments/comment-composer";

export function Discussion({
  comments,
  enabled = true,
  hasMore = false,
  loading,
  loadingMore = false,
  onCreate,
  onDelete,
  onLoadMore,
}: {
  comments: DiscussionCommentRecord[];
  enabled?: boolean;
  hasMore?: boolean;
  loading: boolean;
  loadingMore?: boolean;
  onCreate: (content: string, parentCommentId: string | null) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onLoadMore?: () => Promise<void>;
}) {
  useLocaleSubscription();
  const session = useSession();
  const [commentDraft, setCommentDraft] = React.useState("");
  const [replyDraft, setReplyDraft] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const profiles = useDiscussionProfiles(comments);

  async function submit(reply = false) {
    const value = (reply ? replyDraft : commentDraft).trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await onCreate(value, reply ? replyTo : null);
      if (reply) {
        setReplyDraft("");
        setReplyTo(null);
      } else {
        setCommentDraft("");
      }
      toast.success(reply ? translate('ui.discussion.replySent') : translate('ui.discussion.commentSent'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : translate('ui.discussion.submitFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="discussion-title">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-muted-foreground" />
        <h2 className="font-semibold" id="discussion-title">{translate('ui.discussion.title')}</h2>
        <span className="text-sm tabular-nums text-muted-foreground">
          {comments.length}
        </span>
      </div>
      {!enabled ? (
        <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">{translate('ui.discussion.disabled')}</p>
      ) : null}
      {loading ? (
        <div className="t-skeleton h-24 rounded-xl bg-muted" />
      ) : comments.length === 0 && enabled ? (
        <Card className="t-reveal-content gap-0 overflow-hidden p-0">
          <CommentComposer
            busy={busy}
            content={commentDraft}
            main
            onChange={setCommentDraft}
            onSubmit={() => submit(false)}
          />
        </Card>
      ) : comments.length > 0 ? (
        <Card className="t-reveal-content gap-0 overflow-hidden p-0">
          <StaggerList className="divide-y">
            {comments.map((comment) => (
              <StaggerItem key={comment.id}>
                <CommentRow
                  comment={comment}
                  currentUid={session.user?.uid}
                  onDelete={onDelete}
                  onReply={(commentId) => {
                    setReplyDraft("");
                    setReplyTo(commentId);
                  }}
                  profile={profiles[comment.author_uid]}
                />
                {enabled && replyTo === comment.id ? (
                  <CommentComposer
                    busy={busy}
                    content={replyDraft}
                    onCancel={() => {
                      setReplyDraft("");
                      setReplyTo(null);
                    }}
                    onChange={setReplyDraft}
                    onSubmit={() => submit(true)}
                    reply
                  />
                ) : null}
                {comment.replies.length > 0 ? (
                  <div className="ml-8 border-l sm:ml-11">
                    {comment.replies.map((reply) => (
                      <CommentRow
                        comment={reply}
                        compact
                        currentUid={session.user?.uid}
                        key={reply.id}
                        onDelete={onDelete}
                        onReply={() => {
                          setReplyDraft("");
                          setReplyTo(comment.id);
                        }}
                        profile={profiles[reply.author_uid]}
                      />
                    ))}
                  </div>
                ) : null}
              </StaggerItem>
            ))}
          </StaggerList>
          {enabled ? (
            <CommentComposer
              busy={busy}
              content={commentDraft}
              main
              separated
              onChange={setCommentDraft}
              onSubmit={() => submit(false)}
            />
          ) : null}
        </Card>
      ) : null}
      {hasMore && onLoadMore ? (
        <div className="flex justify-center">
          <Button
            disabled={loadingMore}
            onClick={() => void onLoadMore()}
            size="sm"
            variant="outline"
          >
            {loadingMore ? <LoaderCircle className="t-spinner" /> : null}
            {loadingMore ? translate('ui.common.loadingMore') : translate('ui.discussion.loadMore')}
          </Button>
        </div>
      ) : null}
    </section>
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
  onReply: (commentId: string) => void;
  profile?: UserPublicProfile;
}) {
  const name = profile?.displayName || translate('ui.common.schoolMember');
  return (
    <article className="p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <Avatar className={compact ? "size-7" : "size-8"}>
          <AvatarImage alt={name} src={profile?.photoUrl ?? undefined} />
          <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[0.9375rem] font-medium">{name}</p>
            <p className="shrink-0 text-[0.8125rem] text-muted-foreground">
              {formatRelativeTime(comment.created_at)}
            </p>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-base leading-7 text-foreground/84">
            {comment.content}
          </p>
          <div className="mt-2 flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={translate('ui.discussion.reply')}
                  onClick={() => onReply(comment.id)}
                  size="icon-xs"
                  variant="ghost"
                >
                  <Reply />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{translate('ui.discussion.reply')}</TooltipContent>
            </Tooltip>
            {currentUid === comment.author_uid ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={translate('ui.common.delete')}
                    onClick={() =>
                      void onDelete(comment.id).catch((error) =>
                        toast.error(
                          error instanceof Error ? error.message : translate('ui.common.deleteFailed'),
                        ),
                      )
                    }
                    size="icon-xs"
                    variant="ghost"
                  >
                    <Trash2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{translate('ui.common.delete')}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
