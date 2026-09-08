"use client";

import { usePlatformDashboard } from "@/hooks/use-platform-dashboard";
import { usePermissionRedirect } from "@/hooks/use-permission-redirect";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { useI18n } from "@/i18n";

export default function DashboardPage() {
  const dashboard = usePlatformDashboard();
  const { t } = useI18n();
  usePermissionRedirect(dashboard.canView);
  return <DashboardView data={dashboard.data} error={dashboard.canView ? dashboard.error : t('ui.dashboard.noPermission')} loading={dashboard.loading} onRefresh={() => void dashboard.load(true)} reveal={dashboard.revealFields} />;
}
