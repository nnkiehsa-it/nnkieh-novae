"use client";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import { AdminOverview } from "@/components/admin/admin-overview";
import { AdminPage } from "@/components/admin/admin-page";
import { adminAccessOf } from "@/components/admin/admin-sections";

export default function AdministrationPage() {
  useLocaleSubscription();
  const session = useSession();
  return (
    <AdminPage
      back="/settings"
      title={translate("admin.title")}
    >
      <AdminOverview access={adminAccessOf(session)} />
    </AdminPage>
  );
}
