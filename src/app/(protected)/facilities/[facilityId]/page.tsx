"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import {
  Check,
  Clock3,
  MapPin,
  MoreHorizontal,
  Trash2,
  Hand,
} from "lucide-react";
import { toast } from "sonner";
import { useFacilityDetail } from "@/hooks/use-facility-detail";
import { findFacilityCategory } from "@/hooks/use-categories";
import { ContentRenderer } from "@/components/content-renderer";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { DetailToolbar } from "@/components/detail-toolbar";
import { FacilityStatusDialog } from "@/components/facilities/facility-status-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/ui/page-state";
import { DetailRouteSkeleton } from "@/components/ui/route-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";
import { shareCurrentPage } from "@/lib/share";

export default function FacilityDetailPage() {
  useLocaleSubscription();
  const detail = useFacilityDetail();

  if (detail.loading)
    return (
      <DetailRouteSkeleton
        content={detail.facility?.content}
        kind="facility"
        title={detail.facility?.title}
      />
    );
  if (detail.error || !detail.facility)
    return (
      <ErrorState
        error={detail.error || translate('ui.facility.notFound')}
        onRetry={() => void detail.load(true)}
      />
    );
  const { facility } = detail;
  return (
    <div className="space-y-5">
      <DetailToolbar
        actions={
          facility.isOwnFacility || facility.canManageFacility ? (
            <DropdownMenu>
              <Tooltip>
                <DropdownMenuTrigger asChild>
                  <TooltipTrigger asChild>
                    <Button aria-label={translate('ui.common.moreActions')} size="icon" variant="ghost">
                      <MoreHorizontal />
                    </Button>
                  </TooltipTrigger>
                </DropdownMenuTrigger>
                <TooltipContent>{translate('ui.common.moreActions')}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {facility.canManageFacility ? (
                  <DropdownMenuItem onSelect={() => detail.setStatusOpen(true)}>
                    <Clock3 />
                    {translate('ui.facility.updateStatus')}
                  </DropdownMenuItem>
                ) : null}
                {facility.canManageFacility ? <DropdownMenuSeparator /> : null}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={(event) => event.preventDefault()}
                    >
                      <Trash2 />
                      {translate('ui.facility.deleteReport')}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{translate('ui.facility.deleteTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {translate('ui.facility.deleteShortDescription')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{translate('ui.common.cancel')}</AlertDialogCancel>
                      <PendingAlertDialogAction
                        onConfirm={() => void detail.remove()}
                        state={detail.deleteFeedbackState}
                      >{translate('ui.common.confirmDelete')}</PendingAlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
        backLabel={translate('ui.facility.back')}
        onBack={detail.back}
        onShare={() =>
              void shareCurrentPage(facility.title)
                .then((result) => {
                  if (result === "copied")
                    toast.success(translate('ui.common.linkCopied'));
                })
                .catch(() => toast.error(translate('ui.common.shareFailed')))
        }
        shareLabel={translate('ui.facility.share')}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="border-b px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-[var(--shadow-control)]">
                <SkeletonReveal className="min-w-16" skeleton={<Skeleton className="h-3 w-16" />}><span>{findFacilityCategory(facility.category_id)?.label || translate('ui.nav.facilities')}</span></SkeletonReveal>
              </span>
              <StatusBadge domain="facility" revealLabel status={facility.status} />
            </div>
            <SkeletonReveal as="div" className="mt-3" skeleton={<Skeleton className="h-8 w-4/5" />}><h1 className="text-balance text-2xl font-semibold leading-8 sm:text-[1.75rem] sm:leading-9">
              {facility.title}
            </h1></SkeletonReveal>
            <div className="mt-3 flex flex-wrap gap-3 text-[0.8125rem] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                <SkeletonReveal skeleton={<Skeleton className="h-4 w-24" />}><span>{facility.location}</span></SkeletonReveal>
              </span>
              <SkeletonReveal skeleton={<Skeleton className="h-4 w-32" />}><span>{formatDate(facility.created_at)}</span></SkeletonReveal>
            </div>
          </div>
          <CardContent className="py-5 sm:px-7 sm:py-6">
            <ContentRenderer
              content={facility.content}
              fallbackAlt={facility.title}
              revealText
            />
          </CardContent>
          {facility.result_content ? (
            <div className="border-t bg-emerald-500/[0.045] px-5 py-5 sm:px-7">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-success">
                <span
                  className="t-success-check grid size-6 place-items-center rounded-full bg-success/12"
                  data-state="in"
                >
                  <Check className="size-3.5" />
                </span>{translate('ui.common.result')}</div>
              <ContentRenderer
                content={facility.result_content}
                fallbackAlt={translate('ui.issue.resultAlt', { title: facility.title })}
                revealText
              />
            </div>
          ) : null}
        </Card>
        <aside className="space-y-3 lg:sticky lg:top-6">
          <Card className="gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Hand className="size-4 text-muted-foreground" />{translate('ui.facility.affectedCount')}</span>
              <SkeletonReveal skeleton={<Skeleton className="h-6 w-8" />}><AnimatedNumber
                className="text-lg font-semibold"
                value={facility.affected_count}
              /></SkeletonReveal>
            </div>
            <div className="flex justify-end">
              <LikeActionButton
                active={facility.currentUserAffected === true}
                burst={detail.burst}
                busy={detail.affecting}
                disabled={
                  facility.status === "completed" ||
                  facility.status === "unable-to-handle"
                }
                icon={Hand}
                label={facility.currentUserAffected ? translate('ui.facility.cancelAffected') : translate('ui.facility.markAffected')}
                onClick={() => void detail.toggleAffected()}
              />
            </div>
            </div>
          </Card>
        </aside>
      </div>
      <FacilityStatusDialog
        facility={facility}
        onOpenChange={detail.setStatusOpen}
        onUpdated={detail.setFacility}
        open={detail.statusOpen}
      />
    </div>
  );
}
