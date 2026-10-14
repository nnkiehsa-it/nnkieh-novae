"use client";

import { ClockClockwise, Hand, MapPin } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { FACILITY_STATUS_LABELS, isFacilityClosed } from "@/constants/statuses";
import { findFacilityCategory } from "@/hooks/use-categories";
import { useFacilityDetail } from "@/hooks/use-facility-detail";
import { formatDate } from "@/lib/format";
import { Markdown } from "@/features/content/markdown";
import { ReactionButton } from "@/features/content/reaction";
import { RecordActions, RecordError, RecordHeader, RecordSkeleton, type RecordAction } from "@/features/content/record-view";
import { ResolutionNotice } from "@/features/content/resolution-notice";
import { StatusChip } from "@/features/content/status";
import { AnimatedNumber } from "@/ui/animated-number";
import { Chip } from "@/ui/chip";
import { Panel } from "@/ui/panel";
import { FacilityStatusSheet } from "./facility-status-sheet";

export function FacilityDetail() {
  const { t } = useI18n();
  const detail = useFacilityDetail();
  const facility = detail.facility;

  if (!facility) {
    if (detail.loading) return <RecordSkeleton />;
    return <RecordError message={detail.error || t("ui.facility.notFound")} onRetry={() => void detail.load(true)} />;
  }

  const closed = isFacilityClosed(facility.status);
  const actions: RecordAction[] = facility.canManageFacility
    ? [{ icon: ClockClockwise, label: t("ui.facility.updateStatus"), onSelect: () => detail.setStatusOpen(true) }]
    : [];

  return (
    <article className="grid gap-6">
      <RecordHeader
        actions={
          <RecordActions
            items={actions}
            remove={facility.canDeleteFacility || facility.canManageFacility ? {
              description: t("ui.facility.deleteShortDescription"),
              label: t("ui.facility.deleteReport"),
              onConfirm: () => void detail.remove(),
              status: detail.deleteFeedbackState,
              title: t("ui.facility.deleteTitle"),
            } : undefined}
            shareTitle={facility.title}
          />
        }
        chips={
          <>
            <StatusChip domain="facility" status={facility.status} />
            <Chip>{findFacilityCategory(facility.categoryId)?.label || t("ui.nav.facilities")}</Chip>
          </>
        }
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><MapPin aria-hidden className="size-4" />{facility.location}</span>
            <span>{formatDate(facility.createdAt)}</span>
          </>
        }
        title={facility.title}
      />
      {facility.content?.trim() ? <Markdown content={facility.content} fallbackAlt={facility.title} /> : null}
      {closed ? (
        <ResolutionNotice
          content={facility.resultContent?.trim() || t(FACILITY_STATUS_LABELS[facility.status])}
          fallbackAlt={t("ui.issue.resultAlt", { title: facility.title })}
          title={t("ui.common.result")}
          tone={facility.status === "unable-to-handle" ? "error" : "success"}
        />
      ) : null}
      <Panel className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-muted">{t("ui.facility.affectedCount")}</p>
          <p className="text-2xl font-semibold tabular-nums"><AnimatedNumber value={facility.affectedCount} /></p>
        </div>
        <ReactionButton
          active={facility.currentUserAffected === true}
          burst={detail.burst}
          busy={detail.affecting}
          disabled={closed}
          icon={Hand}
          label={t(facility.currentUserAffected ? "ui.facility.cancelAffected" : "ui.facility.markAffected")}
          onClick={() => void detail.toggleAffected()}
        />
      </Panel>
      {facility.canManageFacility ? (
        <FacilityStatusSheet facility={facility} onOpenChange={detail.setStatusOpen} onUpdated={detail.setFacility} open={detail.statusOpen} />
      ) : null}
    </article>
  );
}
