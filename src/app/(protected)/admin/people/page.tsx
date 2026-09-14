"use client";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import { usePermissionRedirect } from "@/hooks/use-permission-redirect";
import { AdminPage } from "@/components/admin/admin-page";
import { PeopleConsole } from "@/components/admin/people-console";

export default function Page() {
  useLocaleSubscription();
  const session = useSession();
  usePermissionRedirect(session.can("role.manage"), "/admin");
  return (
    <AdminPage title={translate("admin.peopleTitle")}>
      <PeopleConsole />
    </AdminPage>
  );
}
