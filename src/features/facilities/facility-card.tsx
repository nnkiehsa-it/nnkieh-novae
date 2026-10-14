"use client";

import { Hand, MapPin } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import type { FacilitySummary, UserPublicProfile } from "@/types";
import { isFacilityClosed } from "@/constants/statuses";
import { formatRelativeTime } from "@/lib/format";
import { Author } from "@/features/content/person";
import { ReactionButton } from "@/features/content/reaction";
import { StatusChip } from "@/features/content/status";
import { RecordCard } from "@/features/feed/record-card";
import { facilityHref } from "./facility-href";

export function FacilityCard({ affecting, burst, facility, onToggleAffected, profile }: {
  affecting: boolean;
  burst: number;
  facility: FacilitySummary;
  onToggleAffected: () => void;
  profile?: UserPublicProfile;
}) {
  const { t } = useI18n();
  return (
    <RecordCard
      chips={<StatusChip domain="facility" status={facility.status} />}
      footer={
        <>
          <ReactionButton
            active={facility.currentUserAffected === true}
            burst={burst}
            busy={affecting}
            count={facility.affectedCount}
            disabled={isFacilityClosed(facility.status)}
            icon={Hand}
            label={t(facility.currentUserAffected ? "ui.facility.cancelAffected" : "ui.facility.markAffected")}
            onClick={onToggleAffected}
          />
          <span className="ml-auto inline-flex min-w-0 items-center gap-1.5 text-sm text-ink-muted">
            <MapPin aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{facility.location}</span>
          </span>
        </>
      }
      href={facilityHref(facility)}
      label={facility.title}
      meta={
        <>
          <Author profile={profile} />
          <span aria-hidden>·</span>
          <span>{formatRelativeTime(facility.createdAt)}</span>
        </>
      }
      title={facility.title}
    />
  );
}
