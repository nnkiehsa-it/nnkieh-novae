"use client";

import { useState } from "react";
import { AlertTriangle, Building2, FileText, MessageSquare, RefreshCw, UserPlus } from "lucide-react";

import { AnimatedNumber } from "@/components/motion/animated-number";
import { AdminActivityLogDialog, AdminActivityRows } from "@/components/admin/admin-activity-log-dialog";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/page-state";
import { useAdminOverview, type AdminOverviewWindow } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";

const WINDOWS: Array<{ value: AdminOverviewWindow; labelKey: string }> = [
  { value: "24h", labelKey: "ui.adminConsole.window24h" },
  { value: "7d", labelKey: "ui.adminConsole.window7d" },
  { value: "30d", labelKey: "ui.adminConsole.window30d" },
];

export function AdminOverview() {
  const { t } = useI18n();
  const [window, setWindow] = useState<AdminOverviewWindow>("24h");
  const [activityOpen, setActivityOpen] = useState(false);
  const { data, error, load, loading, systemFailures } = useAdminOverview(window);

  if (error && !data) return <ErrorState error={error} onRetry={() => void load()} />;
  if (!data) {
    return (
      <div className="grid min-h-56 place-items-center">
        <LoadingSpinner />
      </div>
    );
  }

  const primaryMetrics = [
    [t("ui.adminConsole.registeredUsers"), data.totalUsers],
    [t("ui.adminConsole.active24h"), data.activeUsers24h],
    [t("ui.adminConsole.active7d"), data.activeUsers7d],
    [t("ui.adminConsole.active30d"), data.activeUsers30d],
  ] as const;
  const periodMetrics = [
    { icon: UserPlus, label: t("ui.adminConsole.newRegistrations"), value: data.newUsers },
    { icon: FileText, label: t("ui.adminConsole.newIssues"), value: data.newIssues },
    { icon: MessageSquare, label: t("ui.adminConsole.newComments"), value: data.newComments },
    { icon: Building2, label: t("ui.adminConsole.newFacilities"), value: data.newFacilities },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {t("ui.adminConsole.overviewTab")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("ui.adminConsole.overviewDescription")}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
          {WINDOWS.map((item) => (
            <Button
              key={item.value}
              onClick={() => setWindow(item.value)}
              size="sm"
              variant={window === item.value ? "default" : "ghost"}
            >
              {t(item.labelKey)}
            </Button>
          ))}
          <Button
            aria-label={t("ui.adminConsole.refresh")}
            disabled={loading}
            onClick={() => void load()}
            size="icon-sm"
            variant="ghost"
          >
            {loading ? <LoadingSpinner /> : <RefreshCw className="size-4" />}
          </Button>
        </div>
      </div>

      <section className="border-y">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4">
          {primaryMetrics.map(([label, value], index) => (
            <div
              className={[
                "px-1 py-5 sm:px-5",
                index > 0 ? "sm:border-l" : "",
                index === 2 ? "sm:border-l-0 lg:border-l" : "",
              ].join(" ")}
              key={label}
            >
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <AnimatedNumber
                className="mt-1 text-3xl font-semibold tracking-[-0.04em]"
                value={value}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t("ui.adminConsole.period")}</h3>
              <span className="text-xs text-muted-foreground">
                {t(WINDOWS.find((item) => item.value === window)?.labelKey ?? "")}
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="grid sm:grid-cols-2">
                {periodMetrics.map(({ icon: Icon, label, value }, index) => (
                  <div
                    className={[
                      "flex items-center gap-3 px-4 py-3.5",
                      index >= 2 ? "border-t" : "",
                      index % 2 === 1 ? "sm:border-l" : "",
                      index === 1 ? "border-t sm:border-t-0" : "",
                    ].join(" ")}
                    key={label}
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <AnimatedNumber className="text-lg font-semibold" value={value} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{t("ui.adminConsole.recentActivity")}</h3>
              <span className="text-xs text-muted-foreground">
                {t("ui.adminConsole.recentActivityScope")}
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
              {data.recentActivity.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("ui.adminConsole.noRecentActivity")}
                </p>
              ) : (
                <AdminActivityRows entries={data.recentActivity} />
              )}
              <div className="border-t p-2">
                <Button className="w-full" onClick={() => setActivityOpen(true)} variant="ghost">
                  {t("ui.adminConsole.viewAllActivity")}
                </Button>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section>
            <h3 className="mb-3 text-sm font-semibold">{t("ui.adminConsole.pending")}</h3>
            <div className="overflow-hidden rounded-xl border bg-card">
              {[
                { label: t("ui.adminConsole.openIssues"), value: data.openIssues, icon: FileText },
                { label: t("ui.adminConsole.openFacilities"), value: data.openFacilities, icon: Building2 },
                { label: t("ui.adminConsole.systemQueue"), value: systemFailures, icon: AlertTriangle },
              ].map(({ label, value, icon: Icon }) => (
                <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0" key={label}>
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 text-sm">{label}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums">{value}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
      <AdminActivityLogDialog
        onOpenChange={setActivityOpen}
        open={activityOpen}
        window={window}
      />
    </div>
  );
}
