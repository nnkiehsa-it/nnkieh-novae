"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { useSearchParams, useRouter } from "next/navigation";
import { administrationNavigation } from '@/components/admin/admin-navigation';
import { useSession } from "@/hooks/use-session";
import { usePermissionRedirect } from "@/hooks/use-permission-redirect";
import { CategoryManagement } from "@/components/admin/category-management";
import { AccessManagement } from "@/components/admin/access-management";
import { AdminAuditLog } from "@/components/admin/admin-audit-log";
import { AdminOverview } from "@/components/admin/admin-overview";
import { UserManagement } from "@/components/admin/user-management";
import { OperationsConsole } from "@/components/admin/operations-console";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ContentTransition, StateTransition } from "@/components/motion/state-transition";
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
  const { tab,options } = administrationNavigation(search.get('tab'), {
    admin:session.isAdmin,overview:canViewOverview,members:canManageMembers,categories:canManageCategories,
  },translate);
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
      <div className="flex pb-5">
        <LiquidTabs
          ariaLabel={translate('ui.admin.items')}
          onValueChange={(value) =>
            router.replace(`/admin/management?tab=${value}`)
          }
          options={options}
          value={tab}
        />
      </div>
      <StateTransition className="min-w-0" data-admin-content identity={tab}>
        <ContentTransition identity={tab}>
          {tab === "operations" ? <OperationsConsole /> : tab === "overview" ? (
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
        </ContentTransition>
      </StateTransition>
    </div>
  );
}
