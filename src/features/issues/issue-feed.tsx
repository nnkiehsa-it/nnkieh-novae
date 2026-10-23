import { AppLink } from "@/ui/app-link";
import { Plus } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import type { IssueSortOption, IssueStatusBucket } from "@/types";
import { useIssueFeed } from "@/hooks/use-issue-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { FeedList } from "@/features/feed/feed-list";
import { FeedFilterLine, FeedTopBar, SearchControl } from "@/features/feed/feed-controls";
import { Button } from "@/ui/button";
import { IssueCard } from "./issue-card";

/** Proposals in one category (or the reader's own), with status, search and order. */
export function IssueFeed({ categoryControl, filter, notice, viewSwitch }: { categoryControl: React.ReactNode; filter: string; notice?: React.ReactNode; viewSwitch: React.ReactNode }) {
  const { t } = useI18n();
  const state = useIssueFeed(filter);
  const profiles = usePublicProfiles(state.feed.issues.map((issue) => issue.authorUid));
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
      <FeedTopBar
        center={viewSwitch}
        left={(
          <SearchControl
            applied={state.committedQuery}
            label={t("ui.issue.searchPlaceholder")}
            onQueryChange={state.setQuery}
            onSearch={state.setCommittedQuery}
            query={state.query}
          />
        )}
        right={mine ? null : (
          <Button aria-label={t("ui.issue.new")} asChild size="icon">
            <AppLink href={composeHref}><Plus weight="bold" /></AppLink>
          </Button>
        )}
      />
      {notice}
      <div className="grid gap-3">
        {categoryControl}
        <FeedFilterLine
          bucket={state.bucket}
          bucketLabel={t("ui.issue.statusFilter")}
          buckets={[
            { label: t("ui.common.active"), value: "active" },
            { label: t("ui.common.closed"), value: "closed" },
          ]}
          onBucketChange={(value: IssueStatusBucket) => state.setBucket(value)}
          onSortChange={(value: IssueSortOption) => state.setSort(value)}
          sort={state.sort}
          sorts={[
            { label: t("ui.common.latest"), value: "latest" },
            { label: t("ui.issue.mostSupported"), value: "most-supported" },
            { label: t("ui.issue.endingSoon"), value: "ending-soon" },
          ]}
        />
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
        onLoadMore={state.loadMore}
        onRetry={state.reload}
        renderItem={(issue) => (
          <IssueCard
            burst={state.supportBurstById[issue.id] ?? 0}
            filter={mine ? issue.category : filter}
            issue={issue}
            onSupport={() => void state.support(issue.id)}
            profile={issue.authorUid ? profiles[issue.authorUid] : undefined}
            showCategory={mine}
            supporting={state.isSupporting(issue.id)}
          />
        )}
      />
    </div>
  );
}
