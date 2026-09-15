"use client";

import * as React from "react";
import {
  Activity,
  BellRing,
  Building2,
  FileText,
  MessageSquare,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  ADMIN_OVERVIEW_WINDOWS,
  type AdminOverviewWindow,
} from "@/constants/admin-activity";
import { useAdminActivity, type AdminOverviewData } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";

const icons: Record<string, LucideIcon> = {
  admin: ShieldCheck,
  announcement: BellRing,
  comment: MessageSquare,
  facility: Building2,
  issue: FileText,
  registration: UserPlus,
};

const labelKeys: Record<string, string> = {
  admin: "ui.adminConsole.activityAdmin",
  announcement: "ui.adminConsole.activityAnnouncement",
  comment: "ui.adminConsole.activityComment",
  facility: "ui.adminConsole.activityFacility",
  issue: "ui.adminConsole.activityIssue",
  registration: "ui.adminConsole.activityRegistration",
};

/**
 * Activity as plain rows, so the group around them draws the hairlines.
 *
 * A row says what kind of thing it is only where that is in question. Inside a
 * group that is already one kind, repeating it on every row says nothing.
 */
export function AdminActivityRows({
  entries,
  showKind = true,
}: {
  entries: AdminOverviewData["recentActivity"];
  showKind?: boolean;
}) {
  const { t } = useI18n();
  return (
    <>
      {entries.map((item, index) => (
        <ListRow
          detail={showKind ? t(labelKeys[item.kind] ?? "ui.adminConsole.activityPlatform") : undefined}
          icon={icons[item.kind] ?? Activity}
          key={`${item.kind}-${item.target_id}-${item.occurred_at}-${index}`}
          label={item.title || "—"}
          value={formatDate(new Date(item.occurred_at))}
        />
      ))}
    </>
  );
}

/** The full activity record, which used to be reachable only through a dialog. */
export function AdminActivityFeed() {
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<AdminOverviewWindow>("24h");
  const activity = useAdminActivity(period);

  return (
    <div className="space-y-5">
      <LiquidTabs
        ariaLabel={t("ui.adminConsole.period")}
        onValueChange={(value) => setPeriod(value as AdminOverviewWindow)}
        options={ADMIN_OVERVIEW_WINDOWS.map((entry) => ({
          label: t(entry.labelKey),
          value: entry.value,
        }))}
        value={period}
      />
      <ListSection>
        {activity.entries.length > 0 ? (
          <AdminActivityRows entries={activity.entries} />
        ) : (
          <ListRow
            label={
              activity.loading
                ? t("ui.common.loadingMore")
                : activity.error || t("ui.adminConsole.noRecentActivity")
            }
          />
        )}
      </ListSection>
      {activity.cursor ? (
        <div className="flex justify-center">
          <Button
            disabled={activity.loading}
            onClick={() => void activity.load(activity.cursor)}
            variant="secondary"
          >
            {activity.loading ? <LoadingSpinner /> : null}
            {t("ui.common.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
