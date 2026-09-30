"use client";

import Link from "next/link";
import { ChevronRight, MessageCircle, Wrench } from "lucide-react";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useHomeStatusCounts } from "@/hooks/use-home-status-counts";
import { ISSUE_BUCKET_STATUSES, FACILITY_BUCKET_STATUSES, ISSUE_STATUS_LABELS, FACILITY_STATUS_LABELS } from "@/constants/statuses";
import { ListSection } from "@/components/ui/list";
import { StatusDistribution, type StatusSegment } from "@/components/ui/status-distribution";
import { Button } from "@/components/ui/button";

function segment(key: string, label: string, count: number, strength: number): StatusSegment {
  return { key, label, count, color: "var(--tint-content)", fill: `color-mix(in srgb, var(--tint-content) ${strength}%, var(--card))` };
}

export function HomeStatusOverview() {
  const { t } = useI18n();
  const { issuesEnabled, facilitiesEnabled } = useCategories();
  const counts = useHomeStatusCounts();
  if (!issuesEnabled && !facilitiesEnabled) return null;
  const rows = [
    ...(issuesEnabled ? [{
      key: "issues", label: t("ui.nav.issues"), href: "/feed", icon: MessageCircle,
      segments: [
        ...ISSUE_BUCKET_STATUSES.active.map((status, index) => segment(status, t(ISSUE_STATUS_LABELS[status]), counts.issues[status], [35, 60, 100][index])),
        segment("closed", t("ui.common.closed"), ISSUE_BUCKET_STATUSES.closed.reduce((total, status) => total + counts.issues[status], 0), 20),
      ],
    }] : []),
    ...(facilitiesEnabled ? [{
      key: "facilities", label: t("ui.home.facilitiesTitle"), href: "/feed?view=facilities", icon: Wrench,
      segments: [
        ...FACILITY_BUCKET_STATUSES.active.map((status, index) => segment(status, t(FACILITY_STATUS_LABELS[status]), counts.facilities[status], [60, 100][index])),
        segment("closed", t("ui.common.closed"), FACILITY_BUCKET_STATUSES.closed.reduce((total, status) => total + counts.facilities[status], 0), 20),
      ],
    }] : []),
  ];
  return (
    <ListSection header={t("ui.home.overallStatus")} groupName={t("ui.home.overallStatus")}>
      {counts.error ? <div className="flex items-center justify-between gap-3 py-3">
        <p className="text-sm text-muted-foreground" role="alert">{t("ui.home.statusLoadFailed")}</p>
        <Button size="sm" variant="ghost" onClick={() => void counts.retry()}>{t("common.retry")}</Button>
      </div> : rows.map(({ key, label, href, icon: Icon, segments }) => (
        <Link className="block space-y-3 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href} key={key} prefetch={false}>
          <span className="flex items-center gap-2">
            <Icon aria-hidden className="size-4 text-[var(--tint-content)]" />
            <span className="flex-1 text-sm font-semibold">{label}</span>
            <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
          </span>
          {!counts.loading && segments.every((item) => item.count === 0)
            ? <p className="text-sm text-muted-foreground">{t("ui.home.noActivity")}</p>
            : <StatusDistribution ariaLabel={label} loading={counts.loading} segments={segments} />}
        </Link>
      ))}
    </ListSection>
  );
}
