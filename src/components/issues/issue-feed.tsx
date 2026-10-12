"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, CircleCheck, CircleDot, Plus } from "lucide-react";
import type { IssueSortOption, IssueStatusBucket } from "@/types";
import { useIssueFeed } from "@/hooks/use-issue-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { getIssueFilterOptions, getIssueSupportGoal, issueAllowsSupport } from "@/constants/categories";
import { Button } from "@/components/ui/button";
import { ToolbarButton } from "@/components/ui/toolbar-button";
import { FeedToolbar } from "@/components/ui/feed-toolbar";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { PageHeader } from "@/components/ui/page-state";
import { FeedList } from "@/components/ui/feed-list";
import { IssueCard } from "@/components/issues/issue-card";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { AnnouncementNotice } from "@/components/announcements/announcement-notice";

export default function IssueFeed({ filterControl, headerHost, selectedFilter }: {
  filterControl?: React.ReactNode;
  headerHost?: HTMLElement | null;
  selectedFilter?: string;
} = {}) {
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
    isSupporting,
  } = useIssueFeed(selectedFilter);
  const profiles = usePublicProfiles(
    feed.issues.map((issue) => issue.author_uid),
  );

  const categoryOptions = getIssueFilterOptions();
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
        portalHost={headerHost}
        actions={
          <>
            {filter !== "my-proposals" ? (
              <ToolbarButton asChild size={headerHost !== undefined ? "icon" : "adaptive"}>
                <Link aria-label={translate('ui.issue.new')} href={`/issues/${encodeURIComponent(filter)}/compose/new`} prefetch={false}>
                  <Plus />{headerHost === undefined ? <span className="hidden sm:inline">{translate('ui.issue.new')}</span> : null}</Link>
              </ToolbarButton>
            ) : null}
          </>
        }
        title={headerHost !== undefined ? null :
          <ChoiceSelect
            ariaLabel={translate('ui.access.selectCategory')}
            className="h-auto max-w-full border-0 bg-transparent p-0 text-2xl font-semibold leading-8 shadow-none"
            controlLabel="heading"
            onValueChange={(value) =>
              router.push(`/issues/${encodeURIComponent(value)}`)
            }
            options={[
              ...categoryOptions,
              { label: translate('ui.issue.mine'), value: "my-proposals" },
            ]}
            title={translate('ui.access.selectCategory')}
            value={filter}
          />
        }
        titleAction={headerHost === undefined ? <AnnouncementNotice /> : undefined}
        toolbar={
          <FeedToolbar
            appliedQuery={committedQuery}
            className={headerHost === undefined ? "order-4" : undefined}
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
        }
      />
      <div className="flex min-w-0 items-center justify-between gap-3">
        {filterControl}
        <LiquidTabs
          ariaLabel={translate('ui.issue.statusFilter')}
          onValueChange={(value) => setBucket(value as IssueStatusBucket)}
          options={[
            { icon: <CircleDot className="size-3.5" />, label: translate('ui.common.active'), value: "active" },
            { icon: <CircleCheck className="size-3.5" />, label: translate('ui.common.closed'), value: "closed" },
          ]}
          value={bucket}
        />
      </div>
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
                <Link href={`/issues/${encodeURIComponent(filter)}/compose/new`} prefetch={false}>
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
                supporting={isSupporting(issue.id)}
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
