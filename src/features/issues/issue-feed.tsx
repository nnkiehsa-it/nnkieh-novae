"use client";

import { AppLink } from "@/ui/app-link";
import { CheckCircle, CircleDashed, Plus } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import type { IssueSortOption, IssueStatusBucket } from "@/types";
import { useIssueFeed } from "@/hooks/use-issue-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { FeedList } from "@/features/feed/feed-list";
import { SearchControl, SortControl } from "@/features/feed/feed-controls";
import { Button } from "@/ui/button";
import { Segmented } from "@/ui/segmented";
import { IssueCard } from "./issue-card";

/** Proposals in one category (or the reader's own), with status, search and order. */
export function IssueFeed({ categoryControl, filter }: { categoryControl: React.ReactNode; filter: string }) {
  const { t } = useI18n();
  const state = useIssueFeed(filter);
  const profiles = usePublicProfiles(state.feed.issues.map((issue) => issue.author_uid));
  const mine = filter === "my-proposals";
  const composeHref = `/issues/${encodeURIComponent(filter)}/compose/new`;
  const underReview = state.feed.statusCounts["under-review"];

  // A member cannot read the review queue, so an empty page while the category
  // still counts proposals under review says where they went.
  const emptyDescription = !state.loading && underReview > 0 ? (
    <>
      {t("issue.pendingReviewCount", { count: underReview })}
      <span className="block">{t("issue.pendingReviewCountHint")}</span>
    </>
  ) : state.committedQuery ? t("ui.issue.emptySearch", { query: state.committedQuery }) : t("ui.issue.emptyCategory");

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {categoryControl}
        <Segmented
          label={t("ui.issue.statusFilter")}
          onChange={(value: IssueStatusBucket) => state.setBucket(value)}
          options={[
            { icon: <CircleDashed weight="bold" />, label: t("ui.common.active"), value: "active" },
            { icon: <CheckCircle weight="bold" />, label: t("ui.common.closed"), value: "closed" },
          ]}
          value={state.bucket}
        />
        <div className="ml-auto flex items-center gap-2">
          <SearchControl
            applied={state.committedQuery}
            label={t("ui.issue.searchPlaceholder")}
            onQueryChange={state.setQuery}
            onSearch={state.setCommittedQuery}
            query={state.query}
          />
          <SortControl
            onChange={(value: IssueSortOption) => state.setSort(value)}
            options={[
              { label: t("ui.common.latest"), value: "latest" },
              { label: t("ui.issue.mostSupported"), value: "most-supported" },
              { label: t("ui.issue.endingSoon"), value: "ending-soon" },
            ]}
            value={state.sort}
          />
          {mine ? null : (
            <Button asChild variant="primary">
              <AppLink href={composeHref}><Plus weight="bold" /><span className="max-sm:sr-only">{t("ui.issue.new")}</span></AppLink>
            </Button>
          )}
        </div>
      </div>
      <FeedList
        empty={{
          action: mine ? undefined : (
            <Button asChild><AppLink href={composeHref}><Plus weight="bold" />{t("ui.issue.createFirst")}</AppLink></Button>
          ),
          description: emptyDescription,
          title: t("ui.issue.emptyTitle"),
        }}
        error={state.error}
        hasMore={state.feed.hasMore}
        items={state.feed.issues}
        loading={state.loading}
        loadingMore={state.loadingMore}
        onLoadMore={() => void state.load(state.feed.cursor)}
        onRetry={() => void state.load()}
        renderItem={(issue) => (
          <IssueCard
            burst={state.supportBurstById[issue.id] ?? 0}
            filter={mine ? issue.category : filter}
            issue={issue}
            onSupport={() => void state.support(issue.id)}
            profile={issue.author_uid ? profiles[issue.author_uid] : undefined}
            showCategory={mine}
            supporting={state.isSupporting(issue.id)}
          />
        )}
      />
    </div>
  );
}
