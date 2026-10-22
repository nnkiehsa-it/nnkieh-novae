import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppNavigate, useRecordId } from "@/hooks/use-app-location";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useSession } from "@/hooks/use-session";
import { useCommentFeed } from "@/hooks/use-comment-feed";
import {
  announcementKeys,
  createAnnouncementComment,
  deleteAnnouncement,
  deleteAnnouncementComment,
  getAnnouncement,
  listAnnouncementComments,
  setAnnouncementLike,
} from "@/services/announcements";
import type { AnnouncementRecord } from "@/types";
import { dropEntity, patchEntity } from "@/lib/query-client";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { feedHref } from "@/lib/feed-href";
import { useOptimisticReaction } from "@/hooks/use-optimistic-reaction";

export function useAnnouncementDetail() {
  const { id: announcementId } = useRecordId("announcement");
  const navigate = useAppNavigate();
  const session = useSession();
  const categories = useCategories();
  const { t } = useI18n();
  const [deleting, setDeleting] = React.useState(false);
  const query = useQuery({
    // An announcement being deleted is not read again while the screen leaves it.
    enabled: !deleting,
    queryKey: announcementKeys.detail(announcementId),
    queryFn: ({ signal }) => getAnnouncement(announcementId, signal),
  });
  const currentAnnouncement = query.data;
  const authorUid = currentAnnouncement?.authorUid;
  const profile = usePublicProfiles([authorUid])[authorUid ?? ""] ?? null;
  const reaction = useOptimisticReaction();
  const deleteFeedback = useActionFeedback();

  const commentsEnabled = Boolean(currentAnnouncement?.commentsEnabled) && categories.announcementCommentsEnabled;
  const commentFeed = useCommentFeed({
    enabled: categories.announcementCommentsEnabled && currentAnnouncement?.commentsEnabled !== false,
    queryKey: (sort) => announcementKeys.comments(announcementId, sort),
    read: (cursor, sort, signal) => listAnnouncementComments(announcementId, cursor, sort, signal),
  });

  async function like() {
    if (!currentAnnouncement) return;
    return reaction.run({
      id: currentAnnouncement.id,
      previous: { active: currentAnnouncement.currentUserLiked, count: currentAnnouncement.likeCount },
      apply: ({ active, count }) =>
        patchEntity<AnnouncementRecord>("announcements", currentAnnouncement.id, { currentUserLiked: active, likeCount: count }),
      request: async (active) => {
        const result = await setAnnouncementLike(currentAnnouncement.id, active);
        return { active: result.liked, count: result.likeCount };
      },
      errorMessage: t("ui.announcement.likeFailed"),
    });
  }

  async function remove() {
    if (!currentAnnouncement) return;
    setDeleting(true);
    try {
      await deleteFeedback.run(() => deleteAnnouncement(currentAnnouncement.id));
      dropEntity("announcements", currentAnnouncement.id);
      toast.success(t("announcement.announcementHasBeenDeleted"));
      navigate(feedHref("announcements"), { replace: true });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
      setDeleting(false);
    }
  }

  async function createComment(content: string, parentId: string | null) {
    const { commentCount } = await createAnnouncementComment(announcementId, content, parentId);
    patchEntity<AnnouncementRecord>("announcements", announcementId, { commentCount });
  }

  async function removeComment(commentId: string) {
    const { commentCount } = await deleteAnnouncementComment(commentId);
    patchEntity<AnnouncementRecord>("announcements", announcementId, { commentCount });
  }

  return {
    announcement: currentAnnouncement,
    burst: reaction.burstById[announcementId] ?? 0,
    canManage: session.can("announcement.manage"),
    comments: commentFeed.comments,
    commentSort: commentFeed.sort,
    commentsEnabled,
    commentsHaveMore: commentFeed.hasMore,
    commentsLoading: commentFeed.loading,
    commentsLoadingMore: commentFeed.loadingMore,
    commentsError: commentFeed.error,
    reloadComments: commentFeed.reload,
    createComment,
    deleteFeedbackState: deleteFeedback.state,
    error: query.error ? query.error.message || t("ui.announcement.notFound") : "",
    like,
    liking: reaction.isBusy(announcementId),
    reload: () => void query.refetch(),
    loading: query.isLoading,
    loadMoreComments: commentFeed.loadMore,
    profile,
    setCommentSort: commentFeed.setSort,
    remove,
    removeComment,
  };
}
