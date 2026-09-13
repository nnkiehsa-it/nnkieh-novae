"use client";

import type { ReactNode } from "react";

import { useSession } from "@/hooks/use-session";
import { usePermissionRedirect } from "@/hooks/use-permission-redirect";
import { UnsavedChangesGuard } from "@/hooks/use-unsaved-changes";
import { ApplyProgress } from "@/components/admin/apply-progress";
import { adminAccessOf } from "@/components/admin/admin-sections";
import { canEnterAdministration } from "@/lib/admin-routes";

export default function AdministrationLayout({ children }: { children: ReactNode }) {
  const session = useSession();
  usePermissionRedirect(canEnterAdministration(adminAccessOf(session)));
  return (
    <>
      {children}
      {/* Work queued by a save outlives the screen that started it, so the
          progress belongs to the area rather than to one of its screens. */}
      <ApplyProgress />
      <UnsavedChangesGuard />
    </>
  );
}
