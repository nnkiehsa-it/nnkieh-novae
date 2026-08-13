"use client";

import { FolderCog, Users } from "lucide-react";
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
  const options = [
    ...(session.can("category.manage")
      ? [{
          icon: <FolderCog className="size-3.5" />,
          label: translate("ui.admin.categories"),
          value: "categories",
        }]
      : []),
    ...(session.can("role.manage")
      ? [{
          icon: <Users className="size-3.5" />,
          label: translate("ui.admin.access"),
          value: "members",
        }]
      : []),
  ];
  const requestedTab = search.get("tab") === "members" ? "members" : "categories";
  const tab = options.some((option) => option.value === requestedTab)
    ? requestedTab
    : options[0]?.value ?? "categories";
  return (
    <div className="space-y-5" aria-busy="true">
      <SecondaryToolbar
        backLabel={translate("ui.common.back")}
        onBack={() => window.history.back()}
      />
      <PageHeader title={translate("ui.admin.title")} />
      <LiquidTabs
        ariaLabel={translate("ui.admin.items")}
        disabled
        onValueChange={() => undefined}
        options={options}
        value={tab}
      />
      {tab === "members" ? (
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
            <div className="border-b px-5 py-4 sm:px-7">
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
          <div className="flex items-center justify-between border-b px-5 py-4 sm:px-7">
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
