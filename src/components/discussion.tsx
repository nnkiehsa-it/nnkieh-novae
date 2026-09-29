"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import * as React from "react";
import { ChevronDown, MessageCircle, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { timing } from "@/lib/motion-timing";
import type { CommentSortOption, DiscussionCommentRecord } from "@/types";
import { useDiscussionProfiles } from "@/hooks/use-public-profiles";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import { ContentTransition, StateTransition } from "@/components/motion/state-transition";
import { CommentComposer } from "@/components/comments/comment-composer";
import { CommentThread } from "@/components/comments/comment-thread";
import { useDiscussionComposer } from "@/hooks/use-discussion-composer";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRows } from "@/components/ui/skeleton-rows";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { useCategories } from "@/hooks/use-categories";
import { stripMarkdownImages } from "@/lib/markdown-images";

interface ReplyTarget {
  authorUid: string;
  content: string;
  parentCommentId: string;
}

function getReplyExcerpt(content: string) {
  const characters = Array.from(stripMarkdownImages(content).trim().replace(/\s+/gu, " "));
  if (characters.length === 0) return translate("markdown.imageAttachments");
  const excerpt = characters.slice(0, 20).join("");
  return characters.length > 20 ? `${excerpt}…` : excerpt;
}

export function Discussion({
  comments,
  enabled = true,
  error,
  hasMore = false,
  loading,
  loadingMore = false,
  onCreate,
  onDelete,
  onLoadMore,
  onSortChange,
  onRetry,
  sort,
  targetKey,
  categoryId,
}: {
  comments: DiscussionCommentRecord[];
  enabled?: boolean;
  error?: string;
  hasMore?: boolean;
  loading: boolean;
  loadingMore?: boolean;
  onCreate: (content: string, parentCommentId: string | null) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onLoadMore?: () => Promise<void>;
  onSortChange: (sort: CommentSortOption) => void;
  onRetry?: () => Promise<void>;
  sort: CommentSortOption;
  targetKey: string;
  categoryId?: string;
}) {
  useLocaleSubscription();
  const session = useSession();
  const [replyTarget, setReplyTarget] = React.useState<ReplyTarget | null>(null);
  const categories = useCategories();
  const [target, scopeId] = targetKey.split(":");
  const maxImages = target === "announcement" ? categories.features.announcementCommentMaxImages
    : categories.issueCategories.find((item) => item.id === categoryId)?.commentMaxImages ?? 0;
  const composer = useDiscussionComposer(session.user?.uid, targetKey, replyTarget?.parentCommentId ?? null, onCreate, {
    targetType: target === "announcement" ? "announcement_comment" : "comment", scopeId, maxImages,
  });
  const profiles = useDiscussionProfiles(comments);
  const composerDockRef = React.useRef<HTMLDivElement>(null);
  const view = !enabled ? "disabled" : loading && !comments.length ? "loading" : "content";

  React.useLayoutEffect(() => {
    if (!enabled || !composerDockRef.current) return;
    const root = document.documentElement;
    const dock = composerDockRef.current;
    const updateClearance = () => {
      root.style.setProperty(
        "--discussion-composer-height",
        `${Math.ceil(dock.getBoundingClientRect().height)}px`,
      );
    };
    updateClearance();
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateClearance);
    observer?.observe(dock);
    return () => {
      observer?.disconnect();
      root.style.removeProperty("--discussion-composer-height");
    };
  }, [enabled]);

  return (
    <section aria-labelledby="discussion-title" aria-busy={loading || loadingMore}>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center gap-2 px-5 py-4 sm:px-7">
          <MessageCircle className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium" id="discussion-title">{translate("ui.discussion.title")}</h2>
          <span className="text-sm tabular-nums text-muted-foreground">{comments.length}</span>
          {loading && comments.length > 0 ? <LoadingSpinner /> : null}
          <ChoiceSelect
            ariaLabel={translate("ui.discussion.sort")}
            className="ml-auto size-9 shrink-0 justify-center gap-0 px-0 [&_.t-disclosure-icon]:hidden"
            onValueChange={(value) => onSortChange(value as CommentSortOption)}
            options={[
              { label: translate("ui.discussion.newest"), value: "newest" },
              { label: translate("ui.discussion.oldest"), value: "oldest" },
            ]}
            title={translate("ui.discussion.sort")}
            trigger={(selected) => <><SlidersHorizontal aria-hidden className="size-4" /><span className="sr-only">{selected?.label}</span></>}
            value={sort}
          />
        </div>

        {error ? (
          <div className="flex items-center justify-between gap-3 bg-destructive/8 px-5 py-3 sm:px-7">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            {onRetry ? <Button disabled={loading || loadingMore} onClick={() => void onRetry()} size="sm">{translate("common.retry")}</Button> : null}
          </div>
        ) : null}

        <StateTransition identity={view}>
          <ContentTransition identity={view}>
            {!enabled ? (
              <p className="bg-muted/20 px-5 py-4 text-sm text-muted-foreground sm:px-7">{translate("ui.discussion.disabled")}</p>
            ) : null}

            {view === "loading" ? (
              <SkeletonRows rows={2} />
            ) : comments.length > 0 ? (
              <StaggerList className="divide-y">
                {comments.map((comment) => (
                  <StaggerItem key={comment.id}>
                    <CommentThread
                      comment={comment}
                      currentUid={session.user?.uid}
                      onDelete={onDelete}
                      onReply={(target, parentCommentId) => {
                        if (composer.busy || !enabled) return;
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
          </ContentTransition>
        </StateTransition>

        {hasMore && onLoadMore ? (
          <div className="flex justify-center px-5 py-4 sm:px-7">
            <Button disabled={loadingMore} onClick={() => void onLoadMore()} size="sm" variant="outline">
              {loadingMore ? <LoadingSpinner /> : <ChevronDown />}
              {loadingMore ? translate("ui.common.loadingMore") : translate("ui.discussion.loadMore")}
            </Button>
          </div>
        ) : null}
      </Card>

      {enabled ? (
        <div className="discussion-composer-dock" ref={composerDockRef}>
          <div className="mx-auto w-full max-w-2xl rounded-[2rem] border bg-background p-2 shadow-[var(--shadow-floating)]">
            <AnimatePresence initial={false}>
            {replyTarget ? (
              <motion.div
                className="mb-1 flex items-start gap-3 overflow-hidden border-b px-2 pb-2 pt-1"
                initial={{ height: 0, opacity: 0, y: 8 }}
                animate={{ height: "auto", opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: 8 }}
                transition={timing("control")}
              >
                <div className="min-w-0 flex-1 text-xs leading-5">
                  {profiles[replyTarget.authorUid] ? (
                    <p className="font-medium text-foreground">
                      {translate("ui.discussion.replying", {
                        name: profiles[replyTarget.authorUid].displayName,
                      })}
                    </p>
                  ) : <Skeleton className="h-3 w-24" />}
                  <p className="truncate text-muted-foreground">{getReplyExcerpt(replyTarget.content)}</p>
                </div>
                <Button
                  aria-label={translate("ui.common.cancel")}
                  className="shrink-0"
                  onClick={() => {
                    if (composer.busy) return;
                    setReplyTarget(null);
                  }}
                  size="icon-xs"
                  variant="ghost"
                >
                  <X />
                </Button>
              </motion.div>
            ) : null}
            </AnimatePresence>
            <CommentComposer
              images={composer.images}
              busy={composer.busy}
              content={composer.content}
              draftStatus={composer.status}
              feedbackState={composer.feedbackState}
              onChange={composer.update}
              onSubmit={composer.submit}
              reply={Boolean(replyTarget)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
