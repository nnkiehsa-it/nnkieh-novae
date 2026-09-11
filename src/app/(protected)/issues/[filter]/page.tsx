"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, Plus } from "lucide-react";
import type { IssueSortOption, IssueStatusBucket } from "@/types";
import { useIssueFeed } from "@/hooks/use-issue-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { getIssueFilterOptions, getIssueSupportGoal, issueAllowsSupport } from "@/constants/categories";
import { ISSUE_BUCKET_STATUSES, ISSUE_STATUS_LABELS } from "@/constants/statuses";
import { Button } from "@/components/ui/button";
import { FeedToolbar } from "@/components/ui/feed-toolbar";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-state";
import { FeedList } from "@/components/ui/feed-list";
import { StatusDistribution } from "@/components/ui/status-distribution";
import { statusFillColor, statusTextColor } from "@/components/ui/status-badge";
import { IssueCard } from "@/components/issues/issue-card";

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
  const statusSegments = ISSUE_BUCKET_STATUSES[bucket].map((status) => ({
    color: statusTextColor(status),
    count: feed.statusCounts[status],
    fill: statusFillColor(status),
    key: status,
    label: translate(ISSUE_STATUS_LABELS[status]),
  }));
  // An ordinary member cannot read a review queue, so a page that is empty while the
  // category still counts proposals under review needs to say where they went.
  const emptyDescription = !loading && feed.statusCounts['under-review'] > 0 ? (
    <>
      {translate('issue.pendingReviewCount', { count: feed.statusCounts['under-review'] })}
      <span className="block">{translate('issue.pendingReviewCountHint')}</span>
    </>
  ) : committedQuery
    ? translate('ui.issue.emptySearch', { query: committedQuery })
    : translate('ui.issue.emptyCategory');
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
      <FeedToolbar
        onQueryChange={setQuery}
        onSearch={setCommittedQuery}
        onSortChange={(value) => setSort(value as IssueSortOption)}
        options={[
          { value: "latest", label: translate('ui.common.latest') },
          { value: "most-supported", label: translate('ui.issue.mostSupported') },
          { value: "ending-soon", label: translate('ui.issue.endingSoon') },
        ]}
        query={query}
        searchLabel={translate('ui.issue.searchPlaceholder')}
        sort={sort}
      />
      <StatusDistribution
        ariaLabel={translate('ui.issue.statusCounts')}
        loading={loading}
        segments={statusSegments}
      />
      <FeedList
        kind="issue"
        items={feed.issues}
        loading={loading}
        error={error}
        onRetry={() => void load()}
        showProgress={filter === "my-proposals" || (issueAllowsSupport(filter) && Boolean(getIssueSupportGoal(filter)))}
        empty={{
          action:
            filter !== "my-proposals" ? (
              <Button asChild variant="outline">
                <Link href={`/issues/${encodeURIComponent(filter)}/new`}>
                  <Plus />{translate('ui.issue.createFirst')}</Link>
              </Button>
            ) : undefined
          ,
          description: emptyDescription,
          title: translate('ui.issue.emptyTitle'),
        }}
        renderItem={(issue) => (
              <IssueCard
                burst={supportBurstById[issue.id] ?? 0}
                filter={filter === "my-proposals" ? issue.category : filter}
                issue={issue}
                onSupport={() => void support(issue.id)}
                profile={issue.author_uid ? profiles[issue.author_uid] : undefined}
                reveal={revealFields}
                supporting={supportingId === issue.id}
              />
        )}
      />
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
