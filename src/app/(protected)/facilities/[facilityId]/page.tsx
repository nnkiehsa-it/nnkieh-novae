"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import {
  Clock3,
  MoreHorizontal,
  Trash2,
  Hand,
} from "lucide-react";
import { toast } from "sonner";
import { useFacilityDetail } from "@/hooks/use-facility-detail";
import { FacilityDetailContent } from "@/components/facilities/facility-detail-content";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { DetailToolbar } from "@/components/detail-toolbar";
import { FacilityStatusDialog } from "@/components/facilities/facility-status-dialog";
import { Button } from "@/components/ui/button";
import { ResizableCard } from "@/components/ui/resizable-card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { shareCurrentPage } from "@/lib/share";

export default function FacilityDetailPage() {
  useLocaleSubscription();
  const detail = useFacilityDetail();

  if (detail.loading)
    return <DetailRouteSkeleton kind="facility" />;
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
        <FacilityDetailContent
          facility={facility}
          reveal={detail.revealDetail}
        />
        <aside className="space-y-3 lg:sticky lg:top-6">
          <ResizableCard className="gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Hand className="size-4 text-muted-foreground" />{translate('ui.facility.affectedCount')}</span>
              <SkeletonReveal enabled={detail.revealDetail} skeleton={<Skeleton className="h-6 w-8" />}><AnimatedNumber
                className="text-lg font-semibold"
                value={facility.affected_count}
              /></SkeletonReveal>
            </div>
            <div className="flex justify-center">
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
          </ResizableCard>
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
