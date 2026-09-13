"use client";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import { usePermissionRedirect } from "@/hooks/use-permission-redirect";
import { AdminPage } from "@/components/admin/admin-page";
import { PolicySettings } from "@/components/admin/policy-settings";

export default function Page() {
  useLocaleSubscription();
  const session = useSession();
  usePermissionRedirect(session.isAdmin, "/admin");
  return (
    <AdminPage description={translate("admin.policiesDetail")} title={translate("admin.policiesTitle")}>
      <PolicySettings />
    </AdminPage>
  );
}
