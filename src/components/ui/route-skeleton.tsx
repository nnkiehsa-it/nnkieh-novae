"use client";

import { CircleCheck, CircleDot, Plus } from "lucide-react";
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
      className="order-2 sm:order-3"
      compact
      disabled
      onValueChange={() => undefined}
      options={[
        {
          icon: <CircleDot className="size-3.5" />,
          label:
            kind === "facility"
              ? translate("ui.status.processing")
              : translate("ui.common.active"),
          value: "active",
        },
        { icon: <CircleCheck className="size-3.5" />, label: translate("ui.common.closed"), value: "closed" },
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
            <>
              {showCreate ? (
                <Button aria-label={translate(createKeys[kind])} className="order-3 ml-auto opacity-100 sm:order-2 sm:ml-0" disabled size="adaptive">
                  <Plus /><span className="hidden sm:inline">{translate(createKeys[kind])}</span>
                </Button>
              ) : null}
              <StableTabs kind={kind} />
            </>
          ) : showCreate ? (
            <Button className="opacity-100" disabled>
              <Plus />{translate(createKeys[kind])}
            </Button>
          ) : undefined
        }
        title={title || translate(listTitleKeys[kind])}
        toolbar={filters ? (
          <FeedToolbar
            className="order-4"
            disabled
            options={[{ value: "latest", label: translate("ui.common.latest") }]}
            searchLabel={kind === "issue" ? translate("ui.issue.searchPlaceholder") : translate("ui.facility.searchPlaceholder")}
          />
        ) : undefined}
      />
      <FeedList items={[]} kind={kind} loading showProgress={showProgress} />
    </div>
  );
}

export function DetailRouteSkeleton({ kind = "issue" }: { kind?: FeedSkeletonKind }) {
  return <DetailLayout kind={kind} loading />;
}
