"use client";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import { usePermissionRedirect } from "@/hooks/use-permission-redirect";
import { AdminPage } from "@/components/admin/admin-page";
import { CategoryManagement } from "@/components/admin/category-management";

export default function Page() {
  useLocaleSubscription();
  const session = useSession();
  usePermissionRedirect(session.can("category.manage"), "/admin");
  return (
    <AdminPage title={translate("admin.contentTitle")}>
      <CategoryManagement />
    </AdminPage>
  );
}
