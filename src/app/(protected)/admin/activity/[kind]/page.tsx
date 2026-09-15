"use client";

import * as React from "react";
import { notFound, useSearchParams } from "next/navigation";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import { usePermissionRedirect } from "@/hooks/use-permission-redirect";
import { AdminPage } from "@/components/admin/admin-page";
import { ActivityBreakdown } from "@/components/admin/activity-breakdown";
import { adminOverviewWindow, adminPeriodFigure } from "@/constants/admin-activity";
import { adminAccessOf } from "@/components/admin/admin-sections";

export default function Page({ params }: { params: Promise<{ kind: string }> }) {
  useLocaleSubscription();
  const session = useSession();
  const { kind } = React.use(params);
  const period = adminOverviewWindow(useSearchParams().get("window"));
  const figure = adminPeriodFigure(kind);
  usePermissionRedirect(adminAccessOf(session).overview, "/admin");
  if (!figure) notFound();
  return (
    <AdminPage title={translate(figure.labelKey)}>
      <ActivityBreakdown figure={figure} period={period} />
    </AdminPage>
  );
}
