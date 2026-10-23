import { Heart } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { useAnnouncementDetail } from "@/hooks/use-announcement-detail";
import { formatDate } from "@/lib/format";
import { Discussion } from "@/features/content/discussion";
import { Markdown } from "@/features/content/markdown";
import { Author } from "@/features/content/person";
import { ReactionButton } from "@/features/content/reaction";
import { RecordActions, RecordError, RecordHeader, RecordSkeleton } from "@/features/content/record-view";
import { AnimatedNumber } from "@/ui/animated-number";
import { Chip } from "@/ui/chip";
import { Panel } from "@/ui/panel";

export function AnnouncementDetail() {
  const { t } = useI18n();
  const detail = useAnnouncementDetail();
  const announcement = detail.announcement;

  if (!announcement) {
    if (detail.loading) return <RecordSkeleton />;
    return <RecordError message={detail.error || t("ui.announcement.notFound")} onRetry={detail.reload} />;
  }

  return (
    <article className="grid gap-6">
      <RecordHeader
        actions={
          <RecordActions
            remove={detail.canManage ? {
              description: t("ui.announcement.deleteDescription"),
              label: t("ui.announcement.delete"),
              onConfirm: () => void detail.remove(),
              status: detail.deleteFeedbackState,
              title: t("ui.announcement.deleteTitle"),
            } : undefined}
            shareTitle={announcement.title}
          />
        }
        chips={<Chip>{t("ui.announcement.badge")}</Chip>}
        meta={
          <>
            <Author profile={detail.profile ?? undefined} />
            <span aria-hidden>·</span>
            <span>{formatDate(announcement.publishedAt)}</span>
          </>
        }
        title={announcement.title}
      />
      {announcement.content?.trim() ? <Markdown content={announcement.content} fallbackAlt={announcement.title} /> : null}
      <Panel className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          <span className="mr-1.5 text-2xl font-semibold tabular-nums text-ink"><AnimatedNumber value={announcement.likeCount} /></span>
          {t("ui.announcement.peopleLiked")}
        </p>
        <ReactionButton
          active={announcement.currentUserLiked === true}
          burst={detail.burst}
          busy={detail.liking}
          icon={Heart}
          label={t(announcement.currentUserLiked ? "ui.announcement.liked" : "ui.announcement.like")}
          onClick={() => void detail.like()}
        />
      </Panel>
      <Discussion
        comments={detail.comments}
        enabled={detail.commentsEnabled}
        error={detail.commentsError}
        hasMore={detail.commentsHaveMore}
        key={`announcement:${announcement.id}`}
        loading={detail.commentsLoading}
        loadingMore={detail.commentsLoadingMore}
        onCreate={detail.createComment}
        onDelete={detail.removeComment}
        onLoadMore={detail.loadMoreComments}
        onRetry={detail.reloadComments}
        onSortChange={detail.setCommentSort}
        sort={detail.commentSort}
        targetKey={`announcement:${announcement.id}`}
      />
    </article>
  );
}
