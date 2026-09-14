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
  useAdminActivity,
  type AdminOverviewData,
  type AdminOverviewWindow,
} from "@/hooks/use-admin-console";
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

/** Activity as plain rows, so the group around them draws the hairlines. */
export function AdminActivityRows({
  entries,
}: {
  entries: AdminOverviewData["recentActivity"];
}) {
  const { t } = useI18n();
  return (
    <>
      {entries.map((item, index) => (
        <ListRow
          detail={t(labelKeys[item.kind] ?? "ui.adminConsole.activityPlatform")}
          icon={icons[item.kind] ?? Activity}
          key={`${item.kind}-${item.target_id}-${item.occurred_at}-${index}`}
          label={item.title || "—"}
          value={formatDate(new Date(item.occurred_at))}
        />
      ))}
    </>
  );
}

const WINDOWS: ReadonlyArray<{ labelKey: string; value: AdminOverviewWindow }> = [
  { labelKey: "ui.adminConsole.window24h", value: "24h" },
  { labelKey: "ui.adminConsole.window7d", value: "7d" },
  { labelKey: "ui.adminConsole.window30d", value: "30d" },
];

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
        options={WINDOWS.map((entry) => ({ label: t(entry.labelKey), value: entry.value }))}
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
