"use client";

import { Fragment } from "react";
import { MessageCircle, Wrench } from "lucide-react";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useHomeStatusCounts } from "@/hooks/use-home-status-counts";
import { ISSUE_BUCKET_STATUSES, FACILITY_BUCKET_STATUSES, ISSUE_STATUS_LABELS, FACILITY_STATUS_LABELS } from "@/constants/statuses";
import { ListCustomRow, ListNavRow, ListSection } from "@/components/ui/list";
import { StatusDistribution } from "@/components/ui/status-distribution";
import { statusFillColor, statusTextColor } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

export function HomeStatusOverview() {
  const { t } = useI18n();
  const { issuesEnabled, facilitiesEnabled } = useCategories();
  const counts = useHomeStatusCounts();
  if (!issuesEnabled && !facilitiesEnabled) return null;
  const rows = [
    ...(issuesEnabled ? [{
      key: "issues", label: t("ui.nav.issues"), href: "/feed", icon: MessageCircle,
      segments: [
        ...[...ISSUE_BUCKET_STATUSES.active, ...ISSUE_BUCKET_STATUSES.closed].map((status) => ({
          key: status, label: t(ISSUE_STATUS_LABELS[status]), count: counts.issues[status],
          color: statusTextColor(status), fill: statusFillColor(status),
        })),
      ],
    }] : []),
    ...(facilitiesEnabled ? [{
      key: "facilities", label: t("ui.home.facilitiesTitle"), href: "/feed?view=facilities", icon: Wrench,
      segments: [
        ...[...FACILITY_BUCKET_STATUSES.active, ...FACILITY_BUCKET_STATUSES.closed].map((status) => ({
          key: status, label: t(FACILITY_STATUS_LABELS[status]), count: counts.facilities[status],
          color: statusTextColor(status), fill: statusFillColor(status),
        })),
      ],
    }] : []),
  ];
  return (
    <ListSection header={t("ui.home.overallStatus")} groupName={t("ui.home.overallStatus")}>
      {counts.error ? <ListCustomRow><div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="alert">{t("ui.home.statusLoadFailed")}</p>
        <Button size="sm" variant="ghost" onClick={() => void counts.retry()}>{t("common.retry")}</Button>
      </div></ListCustomRow> : rows.map(({ key, label, href, icon, segments }) => (
        <Fragment key={key}>
          <ListNavRow href={href} label={label} icon={icon} />
          <ListCustomRow>
          {!counts.loading && segments.every((item) => item.count === 0)
            ? <p className="text-sm text-muted-foreground">{t("ui.home.noActivity")}</p>
            : <StatusDistribution ariaLabel={label} loading={counts.loading} segments={segments} />}
          </ListCustomRow>
        </Fragment>
      ))}
    </ListSection>
  );
}
