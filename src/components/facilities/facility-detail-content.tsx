"use client";

import { MapPin } from "lucide-react";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import type { FacilityRecord } from "@/types";
import { FACILITY_STATUS_LABELS, isFacilityClosed } from "@/constants/statuses";
import { findFacilityCategory } from "@/hooks/use-categories";
import { formatDate } from "@/lib/format";
import { ContentRenderer } from "@/components/content-renderer";
import { ContentResolutionNotice } from "@/components/content-resolution-notice";
import { DetailCardHeader, DetailCardBody } from "@/components/ui/detail-card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonBadgeLabel, SkeletonReveal } from "@/components/ui/skeleton-reveal";
import { StatusBadge } from "@/components/ui/status-badge";

export function FacilityDetailContent({
  facility,
  reveal,
}: {
  facility: FacilityRecord;
  reveal: boolean;
}) {
  useLocaleSubscription();
  const hasContent = Boolean(facility.content?.trim());
  const resolution = isFacilityClosed(facility.status)
    ? {
        content:
          facility.result_content?.trim() ||
          translate(FACILITY_STATUS_LABELS[facility.status]),
        tone:
          facility.status === "unable-to-handle"
            ? ("error" as const)
            : ("success" as const),
      }
    : null;

  return (
    <>
      <DetailCardHeader
        badges={<>
          <span className="inline-grid place-items-center rounded-full bg-card px-2.5 py-1 text-center text-xs font-medium text-muted-foreground shadow-[var(--shadow-control)]">
            <SkeletonBadgeLabel
              className="min-w-16"
              enabled={reveal}
              skeleton={<Skeleton className="h-3 w-16" />}
            >
              {findFacilityCategory(facility.category_id)?.label ||
                translate("ui.nav.facilities")}
            </SkeletonBadgeLabel>
          </span>
          <StatusBadge
            domain="facility"
            revealLabel={reveal}
            status={facility.status}
          />
        </>}
        title={<SkeletonReveal
          as="div"
          enabled={reveal}
          skeleton={<Skeleton className="h-9 w-3/5" />}
        >
          <h1 className="text-balance">
            {facility.title}
          </h1>
        </SkeletonReveal>}
        metadata={<>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" />
            <SkeletonReveal
              enabled={reveal}
              skeleton={<Skeleton className="h-4 w-24" />}
            >
              <span>{facility.location}</span>
            </SkeletonReveal>
          </span>
          <SkeletonReveal
            enabled={reveal}
            skeleton={<Skeleton className="h-4 w-32" />}
          >
            <span>{formatDate(facility.created_at)}</span>
          </SkeletonReveal>
        </>}
      />
      {hasContent ? (
        <DetailCardBody>
          <ContentRenderer
            content={facility.content}
            fallbackAlt={facility.title}
            revealText={reveal}
          />
        </DetailCardBody>
      ) : null}
      {resolution ? (
        <ContentResolutionNotice
          content={resolution.content}
          fallbackAlt={translate("ui.issue.resultAlt", {
            title: facility.title,
          })}
          reveal={reveal}
          title={translate("ui.common.result")}
          tone={resolution.tone}
        />
      ) : null}
    </>
  );
}
