"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  Hand,
  Heart,
  MessageCircle,
  Plus,
  Search,
  Send,
  Share2,
  SlidersHorizontal,
} from "lucide-react";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/ui/page-state";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { stripMarkdownImages } from "@/lib/format";

export type FeedSkeletonKind = "announcement" | "facility" | "issue";
export type ComposerSkeletonKind = FeedSkeletonKind;

const FEED_SKELETON_COUNTS: Record<FeedSkeletonKind, number> = {
  announcement: 10,
  facility: 20,
  issue: 30,
};

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

function StableDetailToolbar() {
  return (
    <div className="flex h-9 items-center justify-between gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={translate("ui.common.back")}
            onClick={() => window.history.back()}
            size="icon"
            variant="ghost"
          >
            <ArrowLeft />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{translate("ui.common.back")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={translate("ui.common.share")}
            onClick={() => {
              if (navigator.share) void navigator.share({ url: window.location.href });
              else void navigator.clipboard?.writeText(window.location.href);
            }}
            size="icon"
            variant="ghost"
          >
            <Share2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{translate("ui.common.share")}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function FeedCardSkeleton({ index, kind }: { index: number; kind: FeedSkeletonKind }) {
  const hasSummary = kind !== "facility";
  const hasProgress = kind === "issue" && index % 2 === 0;
  const ReactionIcon = kind === "announcement" ? Heart : Hand;
  return (
    <Card className="route-card-skeleton min-h-36 gap-4 p-5 sm:p-6">
      <div className="flex justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-4/5" />
        </div>
        <ArrowUpRight className="size-4 text-muted-foreground" />
      </div>
      {hasSummary ? (
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : null}
      {hasProgress ? (
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ) : null}
      <div className="mt-auto flex items-center gap-2 border-t pt-3">
        {kind !== "announcement" ? <Skeleton className="h-6 w-20 rounded-full" /> : null}
        {kind === "facility" ? <Skeleton className="h-4 w-24" /> : null}
        <Button className="ml-auto opacity-100" disabled size="sm" variant="ghost">
          <ReactionIcon />
          <Skeleton className="h-3 w-5" />
        </Button>
        {kind === "announcement" ? (
          <Button className="opacity-100" disabled size="sm" variant="ghost">
            <MessageCircle />
            <Skeleton className="h-3 w-4" />
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function ListRouteSkeleton({
  kind,
  showCreate = kind !== "announcement",
  title,
}: {
  kind: FeedSkeletonKind;
  showCreate?: boolean;
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
          ) : undefined
        }
        title={title || translate(listTitleKeys[kind])}
      />
      {filters ? (
        <Card className="gap-0 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-40 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 opacity-100"
                disabled
                placeholder={kind === "issue" ? translate("ui.issue.searchPlaceholder") : translate("ui.facility.searchPlaceholder")}
              />
            </div>
            <Button aria-label={translate("ui.common.sort")} className="w-auto min-w-0 gap-1 px-2.5 opacity-100 sm:w-36 sm:gap-2 sm:px-3" disabled variant="outline">
              <SlidersHorizontal />
              <span className="hidden sm:inline">{translate("ui.common.latest")}</span>
            </Button>
          </div>
        </Card>
      ) : null}
      <FeedCardsSkeleton kind={kind} />
    </div>
  );
}

export function FeedCardsSkeleton({ kind }: { kind: FeedSkeletonKind }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch" aria-busy="true">
      {Array.from({ length: FEED_SKELETON_COUNTS[kind] }, (_, index) => (
        <FeedCardSkeleton index={index} key={index} kind={kind} />
      ))}
    </div>
  );
}

export function DetailRouteSkeleton({
  content,
  kind = "issue",
  title,
}: {
  content?: string;
  kind?: FeedSkeletonKind;
  title?: string;
}) {
  useLocaleSubscription();
  return (
    <div className="space-y-5" aria-busy="true" aria-label={translate("ui.common.loading")}>
      <StableDetailToolbar />
      <div className={kind === "announcement" ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start" : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start"}>
        <Card className="min-h-[25rem] gap-0 overflow-hidden py-0">
          <div className="space-y-3 border-b px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            {title ? <h1 className="text-balance text-2xl font-semibold leading-8 sm:text-[1.75rem] sm:leading-9">{title}</h1> : <Skeleton className="h-8 w-4/5" />}
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="space-y-3 px-5 py-5 sm:px-7 sm:py-6">
            {content ? (
              <p className="line-clamp-2 text-base leading-7 text-foreground/84">
                {stripMarkdownImages(content)}
              </p>
            ) : (
              <>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </>
            )}
          </div>
        </Card>
        <Card className="min-h-40 gap-4 p-5 sm:p-6">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-12" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <Button className="mx-auto opacity-100" disabled size="icon-lg">
            <Hand />
          </Button>
        </Card>
      </div>
    </div>
  );
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
          <Button className="ml-auto opacity-100" disabled><Send />{translate(submitKey)}</Button>
        </div>
      </Card>
    </div>
  );
}
