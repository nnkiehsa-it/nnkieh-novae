"use client";

import Link from "next/link";
import { ArrowUpRight, Hand, MapPin } from "lucide-react";
import { t as translate } from "@/i18n";
import type { FacilitySummary, UserPublicProfile } from "@/types";
import { formatRelativeTime } from "@/lib/format";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { ContentAuthor } from "@/components/content-author";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export function FacilityCard({
  affecting,
  burst,
  facility,
  onToggleAffected,
  profile,
}: {
  affecting: boolean;
  burst: number;
  facility: FacilitySummary;
  onToggleAffected: () => void;
  profile?: UserPublicProfile;
}) {
  return (
      <Card className="t-card group relative h-full gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
              <ContentAuthor profile={profile} />
              <span aria-hidden>·</span>
              <span className="shrink-0">{formatRelativeTime(facility.created_at)}</span>
            </div>
            <h2 className="mt-1.5 text-balance font-semibold leading-6 tracking-[-0.015em]">
              <Link className="outline-none after:absolute after:inset-0 focus-visible:underline" href={`/facilities/${facility.id}?category=${encodeURIComponent(facility.category_id)}`}>
                {facility.title}
              </Link>
            </h2>
          </div>
          <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-250 ease-[var(--ease-smooth-out)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
          <StatusBadge domain="facility" status={facility.status} />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            {facility.location}
          </span>
          <LikeActionButton
            active={facility.currentUserAffected === true}
            burst={burst}
            busy={affecting}
            className="z-10 ml-auto"
            count={facility.affected_count}
            disabled={["completed", "unable-to-handle"].includes(facility.status)}
            icon={Hand}
            label={facility.currentUserAffected ? translate('ui.facility.cancelAffected') : translate('ui.facility.markAffected')}
            onClick={onToggleAffected}
            size="sm"
            variant="ghost"
          />
        </div>
      </Card>
  );
}
