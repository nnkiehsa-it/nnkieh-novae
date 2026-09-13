"use client";

import { administrationNavigation } from './admin-navigation';
import { useSearchParams } from "next/navigation";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { SecondaryToolbar } from "@/components/detail-toolbar";
import { Card, CardContent } from "@/components/ui/card";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { PageHeader } from "@/components/ui/page-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";

export function AdministrationSkeleton() {
  useLocaleSubscription();
  const session = useSession();
  const search = useSearchParams();
  const { tab,options } = administrationNavigation(search.get('tab'), {
    admin:session.isAdmin,overview:session.can('dashboard.view'),members:session.can('role.manage'),categories:session.can('category.manage'),
  },translate);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 pb-8" aria-busy="true">
      <SecondaryToolbar
        backLabel={translate("ui.common.back")}
        onBack={() => window.history.back()}
      />
      <PageHeader title={translate("ui.admin.title")} description={translate('ui.admin.description')} />
      <LiquidTabs
        ariaLabel={translate("ui.admin.items")}
        disabled
        onValueChange={() => undefined}
        options={options}
        value={tab}
      />
      {!['members','categories'].includes(tab) ? <Skeleton className="h-48 w-full" /> : tab === "members" ? (
        <div className="space-y-4">
          <Card>
            <p className="text-base font-semibold">{translate("ui.access.scopeStep")}</p>
            <LiquidTabs
              ariaLabel={translate("ui.access.scopeType")}
              disabled
              onValueChange={() => undefined}
              options={[
                { label: translate("ui.access.issueCategory"), value: "issue" },
                { label: translate("ui.access.facilityCategory"), value: "facility" },
                { label: translate("ui.access.announcementManagement"), value: "announcement" },
              ]}
              value="issue"
            />
            <Skeleton className="h-9 w-full rounded-lg" />
          </Card>
          <Card className="gap-0 py-0">
            <div className="px-5 py-4 sm:px-7">
              <p className="text-base font-semibold">{translate("ui.access.currentStep")}</p>
            </div>
            <CardContent className="divide-y p-0">
              {Array.from({ length: 2 }, (_, index) => (
                <div className="flex items-center gap-3 p-4" key={index}>
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="gap-0 py-0">
          <div className="flex items-center justify-between px-5 py-4 sm:px-7">
            <span className="text-sm font-semibold">
              {translate("ui.admin.issueFeature")}
            </span>
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <CardContent className="grid gap-3 py-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                className="grid gap-3 rounded-xl border bg-[var(--surface-inset)] p-5 sm:grid-cols-2 sm:p-6"
                key={index}
              >
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
