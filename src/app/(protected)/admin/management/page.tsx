"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { useSearchParams, useRouter } from "next/navigation";
import { ChartNoAxesCombined, FileClock, FolderCog, Shield, Users } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { usePermissionRedirect } from "@/hooks/use-permission-redirect";
import { CategoryManagement } from "@/components/admin/category-management";
import { AccessManagement } from "@/components/admin/access-management";
import { AdminAuditLog } from "@/components/admin/admin-audit-log";
import { AdminOverview } from "@/components/admin/admin-overview";
import { UserManagement } from "@/components/admin/user-management";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ErrorState, PageHeader } from "@/components/ui/page-state";
import { SecondaryToolbar } from "@/components/detail-toolbar";
import { returnToPreviousInAppRoute } from "@/lib/navigation-memory";

export default function AdministrationPage() {
  useLocaleSubscription();
  const router = useRouter();
  const search = useSearchParams();
  const session = useSession();
  const canManageMembers = session.can("role.manage");
  const canManageCategories = session.can("category.manage");
  const canViewOverview = session.can("dashboard.view");
  const canManage = canManageMembers || canManageCategories || canViewOverview;
  usePermissionRedirect(canManage);
  const requested = search.get("tab");
  const requestedTab =
    requested === "users"
      || requested === "members"
      || requested === "categories"
      || requested === "audit"
      || requested === "overview"
      ? requested
      : "overview";
  const tab =
    requestedTab === "overview" && canViewOverview
      ? "overview"
      : requestedTab === "users" && canManageMembers
        ? "users"
        : requestedTab === "members" && canManageMembers
          ? "members"
          : requestedTab === "audit" && canManageMembers
            ? "audit"
            : canManageCategories
              ? "categories"
              : canManageMembers
                ? "users"
                : "overview";
  if (!canManage)
    return <ErrorState error={translate('ui.admin.noPermission')} />;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 pb-8">
      <SecondaryToolbar
        backLabel={translate('ui.common.back')}
        onBack={() => returnToPreviousInAppRoute(router, "/settings")}
      />
      <PageHeader
        description={translate('ui.admin.description')}
        title={translate('ui.admin.title')}
      />
      <div className="flex border-b pb-5">
        <LiquidTabs
          ariaLabel={translate('ui.admin.items')}
          onValueChange={(value) =>
            router.replace(`/admin/management?tab=${value}`)
          }
          options={[
          ...(canViewOverview
            ? [
                {
                  icon: <ChartNoAxesCombined className="size-3.5" />,
                  label: translate('ui.adminConsole.overviewTab'),
                  value: "overview",
                },
              ]
            : []),
          ...(canManageMembers
            ? [
                {
                  icon: <Shield className="size-3.5" />,
                  label: translate('ui.adminConsole.usersTab'),
                  value: "users",
                },
              ]
            : []),
          ...(session.can("category.manage")
            ? [
                {
                  icon: <FolderCog className="size-3.5" />,
                  label: translate('ui.admin.categories'),
                  value: "categories",
                },
              ]
            : []),
          ...(session.can("role.manage")
            ? [
                {
                  icon: <Users className="size-3.5" />,
                  label: translate('ui.admin.access'),
                  value: "members",
                },
                {
                  icon: <FileClock className="size-3.5" />,
                  label: translate('ui.adminConsole.auditTab'),
                  value: "audit",
                },
              ]
            : []),
          ]}
          value={tab}
        />
      </div>
      <div className="t-panel-reveal min-w-0" key={tab}>
        {tab === "overview" ? (
          <AdminOverview />
        ) : tab === "users" ? (
          <UserManagement />
        ) : tab === "members" ? (
          <AccessManagement />
        ) : tab === "audit" ? (
          <AdminAuditLog />
        ) : (
          <CategoryManagement />
        )}
      </div>
    </div>
  );
}
