"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import type { IssueSortOption, IssueStatusBucket } from "@/types";
import { useIssueFeed } from "@/hooks/use-issue-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { getIssueFilterOptions } from "@/constants/categories";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ErrorState,
  PageHeader,
} from "@/components/ui/page-state";
import { FeedCardsSkeleton, FeedEmptyState } from "@/components/ui/route-skeleton";
import { IssueCard } from "@/components/issues/issue-card";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function IssueBoardPage() {
  useLocaleSubscription();
  const router = useRouter();
  const {
    bucket,
    committedQuery,
    error,
    feed,
    filter,
    load,
    loading,
    loadingMore,
    query,
    revealFields,
    setBucket,
    setCommittedQuery,
    setQuery,
    setSort,
    sort,
    support,
    supportBurstById,
    supportingId,
  } = useIssueFeed();
  const profiles = usePublicProfiles(
    feed.issues.map((issue) => issue.author_uid),
  );

  const categoryOptions = getIssueFilterOptions();
  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <div className="flex w-full items-center gap-2">
            {filter !== "my-proposals" ? (
              <Button asChild>
                <Link href={`/issues/${encodeURIComponent(filter)}/new`}>
                  <Plus />{translate('ui.issue.new')}</Link>
              </Button>
            ) : null}
            <LiquidTabs
              className="ml-auto"
              ariaLabel={translate('ui.issue.statusFilter')}
              onValueChange={(value) => setBucket(value as IssueStatusBucket)}
              options={[
                { label: translate('ui.common.active'), value: "active" },
                { label: translate('ui.common.closed'), value: "closed" },
              ]}
              value={bucket}
            />
          </div>
        }
        title={
          <Select
            onValueChange={(value) =>
              router.push(`/issues/${encodeURIComponent(value)}`)
            }
            value={filter}
          >
            <SelectTrigger
              aria-label={translate('ui.access.selectCategory')}
              data-control-label="heading"
              className="h-auto max-w-full border-0 bg-transparent p-0 text-2xl font-semibold leading-8 shadow-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {categoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value="my-proposals">{translate('ui.issue.mine')}</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <Card className="gap-0 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-8"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setCommittedQuery(query.trim());
              }}
              placeholder={translate('ui.issue.searchPlaceholder')}
              value={query}
            />
            {query ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label={translate('ui.common.clearSearch')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground"
                    onClick={() => {
                      setQuery("");
                      setCommittedQuery("");
                    }}
                    type="button"
                  >
                    <X className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{translate('ui.common.clearSearch')}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <Select
            onValueChange={(value) => setSort(value as IssueSortOption)}
            value={sort}
          >
            <SelectTrigger
              aria-label={translate('ui.common.sort')}
              className="w-auto min-w-0 gap-1 px-2.5 sm:w-36 sm:gap-2 sm:px-3"
            >
              <SlidersHorizontal className="shrink-0 sm:hidden" />
              <span className="hidden sm:inline">
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">{translate('ui.common.latest')}</SelectItem>
              <SelectItem value="most-supported">{translate('ui.issue.mostSupported')}</SelectItem>
              <SelectItem value="ending-soon">{translate('ui.issue.endingSoon')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>
      {error && feed.issues.length === 0 ? (
        <ErrorState error={error} onRetry={() => void load()} />
      ) : loading && feed.issues.length === 0 ? (
        <FeedCardsSkeleton kind="issue" />
      ) : feed.issues.length === 0 ? (
        <FeedEmptyState
          action={
            filter !== "my-proposals" ? (
              <Button asChild variant="outline">
                <Link href={`/issues/${encodeURIComponent(filter)}/new`}>
                  <Plus />{translate('ui.issue.createFirst')}</Link>
              </Button>
            ) : undefined
          }
          description={
            committedQuery
              ? translate('ui.issue.emptySearch', { query: committedQuery })
              : translate('ui.issue.emptyCategory')
          }
          title={translate('ui.issue.emptyTitle')}
        />
      ) : (
        <StaggerList
          className="grid gap-3 lg:grid-cols-2 lg:items-stretch"
          key={`${filter}:${bucket}:${sort}:${committedQuery}`}
        >
          {feed.issues.map((issue) => (
            <StaggerItem className="h-full" key={issue.id}>
              <IssueCard
                burst={supportBurstById[issue.id] ?? 0}
                filter={filter === "my-proposals" ? issue.category : filter}
                issue={issue}
                onSupport={() => void support(issue.id)}
                profile={issue.author_uid ? profiles[issue.author_uid] : undefined}
                reveal={revealFields}
                supporting={supportingId === issue.id}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      )}
      {feed.hasMore ? (
        <div className="flex justify-center pt-2">
          <Button
            disabled={loadingMore}
            onClick={() => void load(feed.cursor)}
            variant="outline"
          >
            <ArrowDown />
            {loadingMore ? translate('ui.common.loadingMore') : translate('ui.common.loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
