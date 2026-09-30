"use client";

import { useAdminOverview } from "@/hooks/use-admin-overview";
import { AdminSections } from "@/components/admin/admin-sections";
import { OverviewHealth } from "@/components/admin/overview-health";
import { ErrorState } from "@/components/ui/page-state";
import type { AdminAccess } from "@/lib/admin-routes";

function AdministrationHealth({ canOpenSystem }: { canOpenSystem: boolean }) {
  const { platform, error, load } = useAdminOverview("24h");
  return <>
    {error ? <ErrorState error={error} onRetry={() => void load(true)} /> : null}
    <OverviewHealth canOpenSystem={canOpenSystem} platform={platform} />
  </>;
}

export function AdminOverview({ access }: { access: AdminAccess }) {
  return <div className="space-y-7">
    {access.overview ? <AdministrationHealth canOpenSystem={access.admin} /> : null}
    <AdminSections access={access} />
  </div>;
}
