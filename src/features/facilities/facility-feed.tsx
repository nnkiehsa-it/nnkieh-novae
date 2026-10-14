"use client";

import { AppLink } from "@/ui/app-link";
import { Plus } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import type { FacilitySortOption } from "@/types";
import { useFacilityFeed } from "@/hooks/use-facility-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { FeedList } from "@/features/feed/feed-list";
import { FeedFilterLine, FeedTopBar, SearchControl } from "@/features/feed/feed-controls";
import { Button } from "@/ui/button";
import { FacilityCard } from "./facility-card";
import { facilityComposeHref } from "./facility-href";

/** Facility reports in one category, with status, search and order. */
export function FacilityFeed({ categoryControl, notice, viewSwitch }: { categoryControl: React.ReactNode; notice?: React.ReactNode; viewSwitch: React.ReactNode }) {
  const { t } = useI18n();
  const state = useFacilityFeed();
  const profiles = usePublicProfiles(state.feed.facilities.map((facility) => facility.authorUid));
  const composeHref = facilityComposeHref(state.category);

  return (
    <div className="grid gap-5">
      <FeedTopBar
        center={viewSwitch}
        left={(
          <SearchControl
            applied={state.committedQuery}
            label={t("ui.facility.searchPlaceholder")}
            onQueryChange={state.setQuery}
            onSearch={state.setCommittedQuery}
            query={state.query}
          />
        )}
        right={(
          <Button aria-label={t("ui.facility.new")} asChild size="icon">
            <AppLink href={composeHref}><Plus weight="bold" /></AppLink>
          </Button>
        )}
      />
      {notice}
      <div className="grid gap-3">
        {categoryControl}
        <FeedFilterLine
          bucket={state.bucket}
          bucketLabel={t("ui.facility.statusFilter")}
          buckets={[
            { label: t("ui.status.processing"), value: "active" },
            { label: t("ui.common.closed"), value: "closed" },
          ]}
          onBucketChange={(value: "active" | "closed") => state.setBucket(value)}
          onSortChange={(value: FacilitySortOption) => state.setSort(value)}
          sort={state.sort}
          sorts={[
            { label: t("ui.common.latest"), value: "latest" },
            { label: t("ui.facility.mostAffected"), value: "most-affected" },
          ]}
        />
      </div>
      <FeedList
        empty={{
          action: <Button asChild><AppLink href={composeHref}><Plus weight="bold" />{t("ui.facility.createFirst")}</AppLink></Button>,
          description: state.committedQuery ? t("ui.facility.emptySearch", { query: state.committedQuery }) : t("ui.facility.emptyCategory"),
          title: t("ui.facility.emptyTitle"),
        }}
        error={state.error}
        hasMore={state.feed.hasMore}
        items={state.feed.facilities}
        loading={state.loading}
        loadingMore={state.loadingMore}
        onLoadMore={() => void state.load(state.feed.cursor)}
        onRetry={() => void state.load()}
        renderItem={(facility) => (
          <FacilityCard
            affecting={state.isAffecting(facility.id)}
            burst={state.affectBurstById[facility.id] ?? 0}
            facility={facility}
            onToggleAffected={() => void state.toggleAffected(facility.id)}
            profile={profiles[facility.authorUid]}
          />
        )}
      />
    </div>
  );
}
