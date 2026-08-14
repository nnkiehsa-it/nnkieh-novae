"use client";

import { useRouter } from "next/navigation";
import { Heart, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useAnnouncementDetail } from "@/hooks/use-announcement-detail";
import { formatDate } from "@/lib/format";
import { shareCurrentPage } from "@/lib/share";
import { returnToPreviousRoute } from "@/lib/navigation-memory";
import { ContentRenderer } from "@/components/content-renderer";
import { Discussion } from "@/components/discussion";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { DetailToolbar } from "@/components/detail-toolbar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PendingAlertDialogAction } from "@/components/ui/pending-alert-dialog-action";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/ui/page-state";
import { DetailRouteSkeleton } from "@/components/ui/route-skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";

export default function AnnouncementDetailPage() {
  const router = useRouter();
  const { t } = useI18n();
  const detail = useAnnouncementDetail();
  if (detail.loading)
    return <DetailRouteSkeleton kind="announcement" />;
  if (detail.error || !detail.announcement) {
    return (
      <ErrorState
        error={detail.error || t("ui.announcement.notFound")}
        onRetry={() => void detail.load(true)}
      />
    );
  }
  const { announcement, profile } = detail;
  return (
    <div className={detail.commentsEnabled ? "space-y-5 pb-[calc(7rem+var(--safe-bottom))]" : "space-y-5"}>
      <DetailToolbar
        actions={
          detail.canManage ? (
            <DropdownMenu>
              <Tooltip>
                <DropdownMenuTrigger asChild>
                  <TooltipTrigger asChild>
                    <Button aria-label={t("ui.common.moreActions")} size="icon" variant="ghost">
                      <MoreHorizontal />
                    </Button>
                  </TooltipTrigger>
                </DropdownMenuTrigger>
                <TooltipContent>{t("ui.common.moreActions")}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={(event) => event.preventDefault()}
                    >
                      <Trash2 />
                      {t("ui.announcement.delete")}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("ui.announcement.deleteTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("ui.announcement.deleteDescription")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("ui.common.cancel")}</AlertDialogCancel>
                      <PendingAlertDialogAction
                        onConfirm={() => void detail.remove()}
                        state={detail.deleteFeedbackState}
                      >
                        {t("ui.common.confirmDelete")}
                      </PendingAlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
        backLabel={t("ui.announcement.back")}
        onBack={() =>
          returnToPreviousRoute(router, "/announcements", "/announcements")
        }
        onShare={() =>
              void shareCurrentPage(announcement.title)
                .then((result) => {
                  if (result === "copied") toast.success(t("ui.common.linkCopied"));
                })
                .catch(() => toast.error(t("ui.common.shareFailed")))
        }
        shareLabel={t("ui.announcement.share")}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <article className="space-y-4">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="border-b px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6">
              <p className="text-[0.8125rem] font-medium text-muted-foreground">
                {t("ui.announcement.campus")}
              </p>
              <SkeletonReveal as="div" className="mt-2.5" enabled={detail.revealDetail} skeleton={<Skeleton className="h-8 w-4/5" />}><h1 className="text-balance text-2xl font-semibold leading-8 sm:text-[1.75rem] sm:leading-9">
                {announcement.title}
              </h1></SkeletonReveal>
              <div className="mt-3 flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                <Avatar className="size-5">
                  <AvatarImage
                    alt={profile?.displayName ?? t("ui.announcement.author")}
                    src={profile?.photoUrl ?? undefined}
                  />
                  <AvatarFallback>{profile?.displayName?.slice(0, 1) || "?"}</AvatarFallback>
                </Avatar>
                <SkeletonReveal enabled={detail.revealDetail} skeleton={<Skeleton className="h-4 w-20" />}><span>{profile?.displayName || t("ui.announcement.admin")}</span></SkeletonReveal>
                <span>·</span>
                <SkeletonReveal enabled={detail.revealDetail} skeleton={<Skeleton className="h-4 w-32" />}><span>{formatDate(announcement.published_at)}</span></SkeletonReveal>
              </div>
            </div>
            <CardContent className="py-5 sm:px-7 sm:py-6">
              <ContentRenderer
                content={announcement.content}
                fallbackAlt={announcement.title}
                revealText={detail.revealDetail}
              />
            </CardContent>
          </Card>
          <Discussion
            comments={detail.comments}
            sort={detail.commentSort}
            enabled={detail.commentsEnabled}
            hasMore={detail.commentsHaveMore}
            loading={detail.commentsLoading}
            loadingMore={detail.commentsLoadingMore}
            onCreate={detail.createComment}
            onDelete={detail.removeComment}
            onLoadMore={detail.loadMoreComments}
            onSortChange={detail.setCommentSort}
          />
        </article>
        <aside className="lg:sticky lg:top-6">
          <Card className="gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-4">
            <div className="flex justify-center">
              <LikeActionButton
                active={announcement.currentUserLiked}
                burst={detail.burst}
                busy={detail.liking}
                icon={Heart}
                label={
                  announcement.currentUserLiked
                    ? t("ui.announcement.liked")
                    : t("ui.announcement.like")
                }
                onClick={() => void detail.like()}
                reaction="heart"
              />
            </div>
            <SkeletonReveal as="div" enabled={detail.revealDetail} skeleton={<Skeleton className="mx-auto h-4 w-24" />}><div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <AnimatedNumber value={announcement.like_count} />
              {t("ui.announcement.peopleLiked")}
            </div></SkeletonReveal>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
