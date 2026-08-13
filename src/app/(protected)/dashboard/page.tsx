"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { usePlatformDashboard } from "@/hooks/use-platform-dashboard";
import { usePermissionRedirect } from "@/hooks/use-permission-redirect";
import { getIssueCategoryLabel } from "@/constants/categories";
import { formatDate } from "@/lib/format";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/ui/page-state";

export default function DashboardPage() {
  useLocaleSubscription();
  const router = useRouter();
  const dashboard = usePlatformDashboard();
  usePermissionRedirect(dashboard.canView);
  if (!dashboard.canView)
    return <ErrorState error={translate('ui.dashboard.noPermission')} />;
  if (dashboard.loading && !dashboard.data) return <LoadingState rows={6} />;
  if (dashboard.error && !dashboard.data)
    return <ErrorState error={dashboard.error} onRetry={() => void dashboard.load(true)} />;
  if (!dashboard.data) return null;
  const { operations, stats } = dashboard.data;
  const statsCards = [
    { icon: Users, label: translate('ui.dashboard.users'), value: stats.total_users_seen },
    { icon: Sparkles, label: translate('ui.dashboard.issues'), value: stats.total_issues_created },
    { icon: MessageCircle, label: translate('ui.dashboard.comments'), value: stats.total_comments_created },
    {
      icon: CheckCircle2,
      label: translate('ui.dashboard.supports'),
      value: stats.total_supports_added,
    },
  ];
  const maxCategory = Math.max(1, ...Object.values(stats.issues_by_category));
  const operationCards = [
    { label: translate('ui.dashboard.pendingNotion'), value: operations.pending_notion_sync_count },
    { label: translate('ui.dashboard.failedOutbox'), value: operations.failed_outbox_count },
    { label: translate('ui.dashboard.failedPush'), value: operations.failed_push_delivery_count },
    { label: translate('ui.dashboard.cleanup'), value: operations.cleanup_backlog_count },
    { label: translate('ui.dashboard.stuckUploads'), value: operations.stuck_upload_count },
  ];
  return (
    <div className="t-reveal-content space-y-5">
      <PageHeader
        actions={
          <>
            <Button onClick={() => router.back()} variant="ghost">
              <ArrowLeft />{translate('ui.common.back')}</Button>
            <Button
              disabled={dashboard.loading}
              onClick={() => void dashboard.load(true)}
              variant="outline"
            >
              <RefreshCw className={dashboard.loading ? "t-spinner" : ""} />{translate('ui.dashboard.refresh')}</Button>
          </>
        }
        title={translate('ui.nav.dashboard')}
      />
      <StaggerList className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statsCards.map(({ icon: Icon, label, value }) => (
          <StaggerItem key={label}>
            <Card className="h-full p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{label}</p>
                <span className="grid size-8 place-items-center rounded-xl bg-muted">
                  <Icon className="size-4" />
                </span>
              </div>
              <AnimatedNumber
                className="text-3xl font-semibold tracking-[-0.04em]"
                value={value}
              />
            </Card>
          </StaggerItem>
        ))}
      </StaggerList>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{translate('ui.dashboard.categoryDistribution')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {Object.entries(stats.issues_by_category)
              .toSorted((left, right) => right[1] - left[1])
              .map(([category, count], index) => (
                <div key={category}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">
                      {getIssueCategoryLabel(category)}
                    </span>
                    <AnimatedNumber className="font-medium" value={count} />
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full origin-left rounded-full bg-foreground animate-[dashboard-bar_500ms_var(--ease-smooth-out)_both]"
                      style={
                        {
                          "--dashboard-bar": count / maxCategory,
                          animationDelay: `${index * 40}ms`,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span
                className={`size-2 rounded-full ${operations.overall_status === "healthy" ? "bg-success" : operations.overall_status === "attention" ? "bg-warning" : "bg-destructive"}`}
              />{translate('ui.dashboard.operations')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {operationCards.map((item) => (
              <div
                className="rounded-xl border bg-[var(--surface-inset)] p-3"
                key={item.label}
              >
                <p className="text-xs leading-5 text-muted-foreground">
                  {item.label}
                </p>
                <AnimatedNumber
                  className="mt-1 text-xl font-semibold"
                  value={item.value}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-muted-foreground" />{translate('ui.dashboard.failures')}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {operations.recent_failures.length === 0 ? (
            <div className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" />{translate('ui.dashboard.noFailures')}</div>
          ) : (
            operations.recent_failures.map((failure) => (
              <div className="flex items-start gap-3 p-4" key={failure.id}>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-destructive/8 text-destructive">
                  {failure.source === "outbox" ? (
                    <Database className="size-4" />
                  ) : (
                    <Clock3 className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {failure.source} · {failure.status}
                  </p>
                  <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">
                    {translate('ui.dashboard.trace', { id: failure.error_trace_id })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(failure.updated_at)}
                  </p>
                </div>
                <Button
                  aria-label={translate('ui.dashboard.copyTrace')}
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(failure.error_trace_id)
                      .then(() => toast.success(translate('ui.common.copiedTrace')))
                  }
                  size="icon-sm"
                  variant="ghost"
                >
                  <Copy />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
