"use client";

import type * as React from "react";
import { usePathname } from "next/navigation";
import { usePermissionRedirect } from "@/hooks/use-permission-redirect";
import { UnsavedChangesGuard } from "@/hooks/use-unsaved-changes";
import { useI18n } from "@/i18n";
import { ADMIN_ROUTES, canEnterAdministration } from "@/lib/admin-routes";
import { PageHeader } from "@/ui/page";
import { useAdminAccess } from "./admin-access";
import { AdminNav } from "./admin-nav";
import { ApplyProgress } from "./apply-progress";

/**
 * The frame every administration screen wears: where this area sits in the
 * app, the sections the reader may enter, and the things that outlive a
 * single screen (background work queued by a save, and the guard that stops
 * a link from throwing away an unsaved draft).
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const access = useAdminAccess();
  const entered = canEnterAdministration(access);
  const route = ADMIN_ROUTES.find((candidate) => candidate.href === pathname);
  const permitted = entered && (!route || route.allowed(access));

  usePermissionRedirect(entered);
  usePermissionRedirect(!entered || !route || route.allowed(access), "/admin");

  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 pb-8">
      <PageHeader back={{ href: "/settings", label: t("ui.common.back") }} title={t("admin.title")} />
      <AdminNav access={access} />
      {permitted ? children : null}
      <ApplyProgress />
      <UnsavedChangesGuard />
    </div>
  );
}
