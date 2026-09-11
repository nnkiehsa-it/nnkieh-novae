"use client";

import { Plus } from "lucide-react";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { Button } from "@/components/ui/button";
import { FeedList } from "@/components/ui/feed-list";
import { FeedToolbar } from "@/components/ui/feed-toolbar";
import { DetailLayout } from "@/components/ui/detail-layout";
import { PageHeader } from "@/components/ui/page-state";
import { LiquidTabs } from "@/components/ui/liquid-tabs";

export type FeedSkeletonKind = "announcement" | "facility" | "issue";

const listTitleKeys = {
  announcement: "ui.announcement.title",
  facility: "ui.facility.title",
  issue: "ui.nav.issues",
} as const;

const createKeys = {
  announcement: "ui.announcement.new",
  facility: "ui.facility.new",
  issue: "ui.issue.new",
} as const;

function StableTabs({ kind }: { kind: FeedSkeletonKind }) {
  if (kind === "announcement") return null;
  return (
    <LiquidTabs
      ariaLabel={
        kind === "facility"
          ? translate("ui.facility.statusFilter")
          : translate("ui.issue.statusFilter")
      }
      className="ml-auto"
      disabled
      onValueChange={() => undefined}
      options={[
        {
          label:
            kind === "facility"
              ? translate("ui.status.processing")
              : translate("ui.common.active"),
          value: "active",
        },
        { label: translate("ui.common.closed"), value: "closed" },
      ]}
      value="active"
    />
  );
}

export function ListRouteSkeleton({
  kind,
  showCreate = kind !== "announcement",
  showProgress = true,
  title,
}: {
  kind: FeedSkeletonKind;
  showCreate?: boolean;
  showProgress?: boolean;
  title?: string;
}) {
  useLocaleSubscription();
  const filters = kind !== "announcement";
  return (
    <div className="space-y-5" aria-busy="true" aria-label={translate("ui.common.loading")}>
      <PageHeader
        actions={
          kind !== "announcement" ? (
            <div className="flex w-full items-center gap-2">
              {showCreate ? (
                <Button className="opacity-100" disabled>
                  <Plus />{translate(createKeys[kind])}
                </Button>
              ) : null}
              <StableTabs kind={kind} />
            </div>
          ) : showCreate ? (
            <Button className="opacity-100" disabled>
              <Plus />{translate(createKeys[kind])}
            </Button>
          ) : undefined
        }
        title={title || translate(listTitleKeys[kind])}
      />
      {filters ? (
        <FeedToolbar
          disabled
          options={[{ value: "latest", label: translate("ui.common.latest") }]}
          searchLabel={kind === "issue" ? translate("ui.issue.searchPlaceholder") : translate("ui.facility.searchPlaceholder")}
        />
      ) : null}
      <FeedList items={[]} kind={kind} loading showProgress={showProgress} />
    </div>
  );
}

export function DetailRouteSkeleton({ kind = "issue" }: { kind?: FeedSkeletonKind }) {
  return <DetailLayout kind={kind} loading />;
}
