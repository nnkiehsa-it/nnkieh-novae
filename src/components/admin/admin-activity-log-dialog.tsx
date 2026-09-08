"use client";

import {
  Activity,
  BellRing,
  Building2,
  FileText,
  MessageSquare,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAdminActivity, type AdminOverviewData, type AdminOverviewWindow } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";

function activityIcon(kind: string) {
  if (kind === "registration") return UserPlus;
  if (kind === "issue") return FileText;
  if (kind === "comment") return MessageSquare;
  if (kind === "facility") return Building2;
  if (kind === "announcement") return BellRing;
  if (kind === "admin") return ShieldCheck;
  return Activity;
}

function activityLabelKey(kind: string) {
  if (kind === "registration") return "ui.adminConsole.activityRegistration";
  if (kind === "admin") return "ui.adminConsole.activityAdmin";
  if (kind === "issue") return "ui.adminConsole.activityIssue";
  if (kind === "comment") return "ui.adminConsole.activityComment";
  if (kind === "facility") return "ui.adminConsole.activityFacility";
  if (kind === "announcement") return "ui.adminConsole.activityAnnouncement";
  return "ui.adminConsole.activityPlatform";
}

export function AdminActivityRows({
  entries,
}: {
  entries: AdminOverviewData["recentActivity"];
}) {
  const { t } = useI18n();
  return (
    <div className="divide-y">
      {entries.map((item, index) => {
        const Icon = activityIcon(item.kind);
        return (
          <div className="flex items-center gap-3 px-4 py-3" key={`${item.kind}-${item.target_id}-${item.occurred_at}-${index}`}>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.title || "—"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(activityLabelKey(item.kind))}
              </p>
            </div>
            <time className="shrink-0 text-xs text-muted-foreground">
              {formatDate(new Date(item.occurred_at))}
            </time>
          </div>
        );
      })}
    </div>
  );
}

export function AdminActivityLogDialog({
  onOpenChange,
  open,
  window,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  window: AdminOverviewWindow;
}) {
  const { t } = useI18n();
  const activity = useAdminActivity(window, open);
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-3xl gap-4">
        <DialogHeader>
          <DialogTitle>{t("ui.adminConsole.activityLogTitle")}</DialogTitle>
          <DialogDescription>{t("ui.adminConsole.activityLogDescription")}</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-xl border bg-card">
          {activity.entries.length ? <AdminActivityRows entries={activity.entries} /> : null}
          {!activity.entries.length && !activity.loading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {activity.error || t("ui.adminConsole.noRecentActivity")}
            </p>
          ) : null}
        </div>
        {activity.cursor ? (
          <Button
            className="justify-self-center"
            disabled={activity.loading}
            onClick={() => void activity.load(activity.cursor)}
            variant="secondary"
          >
            {activity.loading ? <LoadingSpinner /> : null}
            {t("ui.common.loadMore")}
          </Button>
        ) : null}
        {activity.loading && !activity.entries.length ? (
          <div className="grid min-h-24 place-items-center"><LoadingSpinner /></div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
