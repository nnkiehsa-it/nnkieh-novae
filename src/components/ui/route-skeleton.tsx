"use client";

import {
  ArrowLeft,
  ArrowUp,
  Plus,
} from "lucide-react";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FeedList } from "@/components/ui/feed-list";
import { FeedToolbar } from "@/components/ui/feed-toolbar";
import { DetailLayout } from "@/components/ui/detail-layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-state";
import { LiquidTabs } from "@/components/ui/liquid-tabs";

export type FeedSkeletonKind = "announcement" | "facility" | "issue";
export type ComposerSkeletonKind = FeedSkeletonKind;

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

export function ComposerRouteSkeleton({
  extraFields = false,
  kind = "issue",
}: {
  extraFields?: boolean;
  kind?: ComposerSkeletonKind;
}) {
  useLocaleSubscription();
  const titleKey = kind === "announcement" ? "ui.announcement.newTitle" : kind === "facility" ? "ui.facility.newTitle" : "ui.issue.newTitle";
  const submitKey = kind === "announcement" ? "ui.announcement.publish" : kind === "facility" ? "ui.facility.submit" : "ui.issue.submit";
  return (
    <div className="mx-auto max-w-3xl space-y-5" aria-busy="true" aria-label={translate("ui.common.loading")}>
      <PageHeader
        actions={
          <Button onClick={() => window.history.back()} variant="ghost">
            <ArrowLeft />{translate("ui.common.back")}
          </Button>
        }
        title={translate(titleKey)}
      />
      <Card className="py-6">
        <div className="grid gap-5 px-5 sm:px-7">
          {extraFields ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">{translate("ui.facility.category")}<Input className="opacity-100" disabled /></label>
              <label className="grid gap-2 text-sm font-medium">{translate("ui.facility.location")}<Input className="opacity-100" disabled /></label>
            </div>
          ) : null}
          <label className="grid gap-2 text-sm font-medium">{kind === "facility" ? translate("ui.facility.reportTitle") : kind === "announcement" ? translate("ui.announcement.titleLabel") : translate("ui.issue.titleLabel")}<Input className="opacity-100" disabled /></label>
          <label className="grid gap-2 text-sm font-medium">{kind === "facility" ? translate("ui.facility.problemDescription") : kind === "announcement" ? translate("ui.announcement.contentLabel") : translate("ui.issue.contentLabel")}<Textarea className="min-h-48 opacity-100" disabled /></label>
          <Button className="ml-auto opacity-100" disabled><ArrowUp />{translate(submitKey)}</Button>
        </div>
      </Card>
    </div>
  );
}
