"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { Clock3, Hand } from "lucide-react";
import { toast } from "sonner";
import { useFacilityDetail } from "@/hooks/use-facility-detail";
import { FacilityDetailContent } from "@/components/facilities/facility-detail-content";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { DetailLayout } from "@/components/ui/detail-layout";
import { DetailToolbar } from "@/components/detail-toolbar";
import { DetailActionsMenu } from "@/components/detail-actions-menu";
import { FacilityStatusDialog } from "@/components/facilities/facility-status-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";
import { shareCurrentPage } from "@/lib/share";

export default function FacilityDetailPage() {
  useLocaleSubscription();
  const detail = useFacilityDetail();

  const { facility } = detail;
  return (
    <DetailLayout
      kind="facility"
      loading={!facility && detail.loading}
      error={!facility && !detail.loading ? detail.error || translate('ui.facility.notFound') : undefined}
      onRetry={() => void detail.load(true)}
      toolbar={facility ? <DetailToolbar
        actions={
          facility.isOwnFacility || facility.canManageFacility ? (
            <DetailActionsMenu
              items={
                facility.canManageFacility
                  ? [
                      {
                        icon: Clock3,
                        label: translate('ui.facility.updateStatus'),
                        onSelect: () => detail.setStatusOpen(true),
                      },
                    ]
                  : []
              }
              remove={{
                description: translate('ui.facility.deleteShortDescription'),
                label: translate('ui.facility.deleteReport'),
                onConfirm: () => void detail.remove(),
                state: detail.deleteFeedbackState,
                title: translate('ui.facility.deleteTitle'),
              }}
            />
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
      /> : undefined}
      content={facility ? <FacilityDetailContent
          facility={facility}
          reveal={detail.revealDetail}
        /> : undefined}
      panels={facility ? [{ key: "reaction", content:
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
      }] : undefined}
      after={facility ? <FacilityStatusDialog
        facility={facility}
        onOpenChange={detail.setStatusOpen}
        onUpdated={detail.setFacility}
        open={detail.statusOpen}
      /> : undefined}
    />
  );
}
