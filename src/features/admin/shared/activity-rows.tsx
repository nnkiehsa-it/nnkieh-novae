"use client";

import { BellRinging, Buildings, ChatCircle, FileText, Pulse, ShieldCheck, UserPlus } from "@phosphor-icons/react/ssr";
import type * as React from "react";
import type { AdminOverviewData } from "@/hooks/use-admin-overview";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { ListRow } from "@/ui/list";

const KINDS: Record<string, { icon: React.ReactNode; labelKey: string }> = {
  admin: { icon: <ShieldCheck />, labelKey: "ui.adminConsole.activityAdmin" },
  announcement: { icon: <BellRinging />, labelKey: "ui.adminConsole.activityAnnouncement" },
  comment: { icon: <ChatCircle />, labelKey: "ui.adminConsole.activityComment" },
  facility: { icon: <Buildings />, labelKey: "ui.adminConsole.activityFacility" },
  issue: { icon: <FileText />, labelKey: "ui.adminConsole.activityIssue" },
  registration: { icon: <UserPlus />, labelKey: "ui.adminConsole.activityRegistration" },
};

const OTHER_KIND = { icon: <Pulse />, labelKey: "ui.adminConsole.activityPlatform" };

/**
 * Activity as list rows. A row names its kind only where that is in question:
 * inside a group that is already one kind, repeating it says nothing.
 */
export function ActivityRows({ entries, showKind = true }: {
  entries: AdminOverviewData["recentActivity"];
  showKind?: boolean;
}) {
  const { t } = useI18n();
  return entries.map((entry, index) => {
    const kind = KINDS[entry.kind] ?? OTHER_KIND;
    return (
      <ListRow
        detail={showKind ? t(kind.labelKey) : undefined}
        icon={kind.icon}
        key={`${entry.kind}-${entry.target_id}-${entry.occurred_at}-${index}`}
        label={entry.title || "—"}
        value={formatDate(new Date(entry.occurred_at))}
      />
    );
  });
}
