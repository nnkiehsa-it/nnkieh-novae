"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown, ChatCircle, X } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { usePersonName } from "@/features/content/person";
import type { CommentSortOption, Comment } from "@/types";
import { stripMarkdownImages } from "@/lib/markdown-images";
import { timing } from "@/lib/motion-timing";
import { useCategories } from "@/hooks/use-categories";
import { useDiscussionComposer } from "@/hooks/use-discussion-composer";
import { useDiscussionProfiles } from "@/hooks/use-public-profiles";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/ui/button";
import { Skeleton, Spinner } from "@/ui/feedback";
import { Select } from "@/ui/select";
import { CommentComposer } from "./comment-composer";
import { CommentThread } from "./comment-thread";

interface ReplyTarget {
  authorUid: string;
  content: string;
  parentCommentId: string;
}

function replyExcerpt(content: string, imagesOnly: string) {
  const characters = Array.from(stripMarkdownImages(content).trim().replace(/\s+/gu, " "));
  if (!characters.length) return imagesOnly;
  return characters.length > 20 ? `${characters.slice(0, 20).join("")}…` : characters.join("");
}

/**
 * The comments under a record, with the composer pinned to the bottom of the
 * screen while they are in view.
 */
export function Discussion({ categoryId, comments, enabled = true, error, hasMore = false, loading, loadingMore = false, onCreate, onDelete, onLoadMore, onRetry, onSortChange, sort, targetKey }: {
  categoryId?: string;
  comments: Comment[];
  enabled?: boolean;
  error?: string;
  hasMore?: boolean;
  loading: boolean;
  loadingMore?: boolean;
  onCreate: (content: string, parentCommentId: string | null) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onLoadMore?: () => Promise<void>;
  onRetry?: () => Promise<void>;
  onSortChange: (sort: CommentSortOption) => void;
  sort: CommentSortOption;
  targetKey: string;
}) {
  const { t } = useI18n();
  const personName = usePersonName();
  const session = useSession();
  const categories = useCategories();
  const [replyTarget, setReplyTarget] = React.useState<ReplyTarget | null>(null);
  const [target, scopeId] = targetKey.split(":");
  const maxImages = target === "announcement"
    ? categories.features.announcementCommentMaxImages
    : categories.issueCategories.find((item) => item.id === categoryId)?.commentMaxImages ?? 0;
  const composer = useDiscussionComposer(session.user?.uid, targetKey, replyTarget?.parentCommentId ?? null, onCreate, {
    maxImages,
    scopeId,
    targetType: target === "announcement" ? "announcement_comment" : "comment",
  });
  const profiles = useDiscussionProfiles(comments);

  return (
    <section aria-busy={loading || loadingMore} aria-labelledby="discussion-title" className="grid gap-3">
      <div className="flex items-center gap-2 px-1">
        <ChatCircle aria-hidden className="size-5 text-ink-muted" />
        <h2 className="text-base font-semibold" id="discussion-title">{t("ui.discussion.title")}</h2>
        <span className="text-sm tabular-nums text-ink-faint">{comments.length}</span>
        {loading && comments.length > 0 ? <Spinner className="size-4" /> : null}
        <Select
          className="ml-auto h-9 bg-transparent px-3 text-sm text-ink-muted hover:bg-surface-raised"
          label={t("ui.discussion.sort")}
          onChange={onSortChange}
          options={[
            { label: t("ui.discussion.newest"), value: "newest" },
            { label: t("ui.discussion.oldest"), value: "oldest" },
          ]}
          value={sort}
        />
      </div>

      <div className="glass overflow-hidden rounded-panel shadow-panel">
        {error ? (
          <div className="flex items-center justify-between gap-3 bg-danger/10 px-5 py-3">
            <p className="text-sm text-danger" role="alert">{error}</p>
            {onRetry ? <Button disabled={loading || loadingMore} onClick={() => void onRetry()} size="sm">{t("common.retry")}</Button> : null}
          </div>
        ) : null}
        {!enabled ? <p className="px-5 py-4 text-sm text-ink-muted">{t("ui.discussion.disabled")}</p> : null}
        {enabled && loading && !comments.length ? (
          <div className="grid gap-5 px-5 py-4">
            {[0, 1].map((row) => (
              <div className="flex gap-3" key={row}>
                <Skeleton className="size-9 rounded-full" />
                <div className="grid flex-1 gap-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-3/4" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {comments.map((comment) => (
              <CommentThread
                comment={comment}
                currentUid={session.user?.uid}
                key={comment.id}
                onDelete={onDelete}
                onReply={(reply, parentCommentId) => {
                  if (composer.busy || !enabled) return;
                  setReplyTarget({ authorUid: reply.authorUid, content: reply.content, parentCommentId });
                }}
                profiles={profiles}
                replyActive={replyTarget?.parentCommentId === comment.id}
              />
            ))}
          </div>
        )}
        {hasMore && onLoadMore ? (
          <div className="flex justify-center border-t border-line px-5 py-3">
            <Button onClick={() => void onLoadMore()} size="sm" status={loadingMore ? "loading" : "idle"} variant="ghost">
              {loadingMore ? null : <CaretDown weight="bold" />}
              {t(loadingMore ? "ui.common.loadingMore" : "ui.discussion.loadMore")}
            </Button>
          </div>
        ) : null}
      </div>

      {enabled ? (
        <div
          className="sticky bottom-0 z-10 mt-1 rounded-panel border border-line bg-surface-solid p-2 shadow-float"
          data-discussion-composer
        >
          <AnimatePresence initial={false}>
            {replyTarget ? (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0, transition: timing("controlExit", "depart") }}
                initial={{ height: 0, opacity: 0 }}
                transition={timing("control")}
              >
                <div className="mb-1 flex items-start gap-3 border-b border-line px-2 pb-2 pt-1">
                  <div className="min-w-0 flex-1 text-sm">
                    {profiles[replyTarget.authorUid] ? (
                      <p className="font-medium">{t("ui.discussion.replying", { name: personName(profiles[replyTarget.authorUid].displayName) })}</p>
                    ) : <Skeleton className="h-3.5 w-24" />}
                    <p className="truncate text-ink-muted">{replyExcerpt(replyTarget.content, t("markdown.imageAttachments"))}</p>
                  </div>
                  <Button aria-label={t("ui.common.cancel")} onClick={() => { if (!composer.busy) setReplyTarget(null); }} size="icon-sm" variant="ghost">
                    <X weight="bold" />
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <CommentComposer
            busy={composer.busy}
            content={composer.content}
            draftStatus={composer.status}
            feedbackState={composer.feedbackState}
            images={composer.images}
            onChange={composer.update}
            onSubmit={composer.submit}
            reply={Boolean(replyTarget)}
          />
        </div>
      ) : null}
    </section>
  );
}
