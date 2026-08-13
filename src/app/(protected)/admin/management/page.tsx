"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { useSearchParams, useRouter } from "next/navigation";
import { FolderCog, Users } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { usePermissionRedirect } from "@/hooks/use-permission-redirect";
import { CategoryManagement } from "@/components/admin/category-management";
import { AccessManagement } from "@/components/admin/access-management";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ErrorState, PageHeader } from "@/components/ui/page-state";

export default function AdministrationPage() {
  useLocaleSubscription();
  const router = useRouter();
  const search = useSearchParams();
  const session = useSession();
  const canManageMembers = session.can("role.manage");
  const canManageCategories = session.can("category.manage");
  const canManage = canManageMembers || canManageCategories;
  usePermissionRedirect(canManage);
  const requestedTab =
    search.get("tab") === "members" ? "members" : "categories";
  const tab =
    requestedTab === "members" && canManageMembers
      ? "members"
      : canManageCategories
        ? "categories"
        : "members";
  if (!canManage)
    return <ErrorState error={translate('ui.admin.noPermission')} />;
  return (
    <div className="space-y-5">
      <PageHeader
        title={translate('ui.admin.title')}
      />
      <LiquidTabs
        ariaLabel={translate('ui.admin.items')}
        onValueChange={(value) =>
          router.replace(`/admin/management?tab=${value}`)
        }
        options={[
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
              ]
            : []),
        ]}
        value={tab}
      />
      <div className="t-panel-reveal" key={tab}>
        {tab === "members" ? <AccessManagement /> : <CategoryManagement />}
      </div>
    </div>
  );
}
