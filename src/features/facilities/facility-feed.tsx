"use client";

import { AppLink } from "@/ui/app-link";
import { CheckCircle, CircleDashed, Plus } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import type { FacilitySortOption } from "@/types";
import { useFacilityFeed } from "@/hooks/use-facility-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { FeedList } from "@/features/feed/feed-list";
import { SearchControl, SortControl } from "@/features/feed/feed-controls";
import { Button } from "@/ui/button";
import { Segmented } from "@/ui/segmented";
import { FacilityCard } from "./facility-card";
import { facilityComposeHref } from "./facility-href";

/** Facility reports in one category, with status, search and order. */
export function FacilityFeed({ categoryControl }: { categoryControl: React.ReactNode }) {
  const { t } = useI18n();
  const state = useFacilityFeed();
  const profiles = usePublicProfiles(state.feed.facilities.map((facility) => facility.author_uid));
  const composeHref = facilityComposeHref(state.category);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {categoryControl}
        <Segmented
          label={t("ui.facility.statusFilter")}
          onChange={(value: "active" | "closed") => state.setBucket(value)}
          options={[
            { icon: <CircleDashed weight="bold" />, label: t("ui.status.processing"), value: "active" },
            { icon: <CheckCircle weight="bold" />, label: t("ui.common.closed"), value: "closed" },
          ]}
          value={state.bucket}
        />
        <div className="ml-auto flex items-center gap-2">
          <SearchControl
            applied={state.committedQuery}
            label={t("ui.facility.searchPlaceholder")}
            onQueryChange={state.setQuery}
            onSearch={state.setCommittedQuery}
            query={state.query}
          />
          <SortControl
            onChange={(value: FacilitySortOption) => state.setSort(value)}
            options={[
              { label: t("ui.common.latest"), value: "latest" },
              { label: t("ui.facility.mostAffected"), value: "most-affected" },
            ]}
            value={state.sort}
          />
          <Button asChild variant="primary">
            <AppLink href={composeHref}><Plus weight="bold" /><span className="max-sm:sr-only">{t("ui.facility.new")}</span></AppLink>
          </Button>
        </div>
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
            profile={profiles[facility.author_uid]}
          />
        )}
      />
    </div>
  );
}
