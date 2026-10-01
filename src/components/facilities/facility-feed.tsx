"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import Link from "next/link";
import { ArrowDown, CircleCheck, CircleDot, Plus } from "lucide-react";
import type { FacilitySortOption } from "@/types";
import { useFacilityFeed } from "@/hooks/use-facility-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { Button } from "@/components/ui/button";
import { ToolbarButton } from "@/components/ui/toolbar-button";
import { FeedToolbar } from "@/components/ui/feed-toolbar";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import {
  PageHeader,
} from "@/components/ui/page-state";
import { FacilityCard } from "@/components/facilities/facility-card";
import { FeedList } from "@/components/ui/feed-list";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { AnnouncementNotice } from "@/components/announcements/announcement-notice";

export default function FacilityFeed({ filterControl, headerHost }: {
  filterControl?: React.ReactNode;
  headerHost?: HTMLElement | null;
} = {}) {
  useLocaleSubscription();
  const state = useFacilityFeed();
  const profiles = usePublicProfiles(
    state.feed.facilities.map((facility) => facility.author_uid),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        portalHost={headerHost}
        actions={
          <>
            <ToolbarButton asChild size={headerHost !== undefined ? "icon" : "adaptive"}>
              <Link
                aria-label={translate('ui.facility.new')}
                href={`/facilities/new?category=${encodeURIComponent(state.category)}`}
                prefetch={false}
              >
                <Plus />{headerHost === undefined ? <span className="hidden sm:inline">{translate('ui.facility.new')}</span> : null}</Link>
            </ToolbarButton>
          </>
        }
        title={headerHost !== undefined ? null :
          <ChoiceSelect
            ariaLabel={translate('ui.access.selectCategory')}
            className="h-auto max-w-full border-0 bg-transparent p-0 text-2xl font-semibold leading-8 shadow-none"
            controlLabel="heading"
            onValueChange={state.changeCategory}
            options={state.categories.map((option) => ({
              label: option.label,
              value: option.id,
            }))}
            title={translate('ui.access.selectCategory')}
            value={state.category}
          />
        }
        titleAction={headerHost === undefined ? <AnnouncementNotice /> : undefined}
        toolbar={
          <FeedToolbar
            appliedQuery={state.committedQuery}
            className={headerHost === undefined ? "order-4" : undefined}
            onQueryChange={state.setQuery}
            onSearch={state.setCommittedQuery}
            onSortChange={(value) => state.setSort(value as FacilitySortOption)}
            options={[
              { value: "latest", label: translate('ui.common.latest') },
              { value: "most-affected", label: translate('ui.facility.mostAffected') },
            ]}
            query={state.query}
            searchLabel={translate('ui.facility.searchPlaceholder')}
            sort={state.sort}
          />
        }
      />
      <div className="flex min-w-0 items-center justify-between gap-3">
        {filterControl}
        <LiquidTabs
          ariaLabel={translate('ui.facility.statusFilter')}
          onValueChange={(value) => {
            state.setBucket(value as "active" | "closed");
            state.setStatus("");
          }}
          options={[
            { icon: <CircleDot className="size-3.5" />, label: translate('ui.status.processing'), value: "active" },
            { icon: <CircleCheck className="size-3.5" />, label: translate('ui.common.closed'), value: "closed" },
          ]}
          value={state.bucket}
        />
      </div>
      <FeedList
        kind="facility"
        items={state.feed.facilities}
        loading={state.loading}
        error={state.error}
        onRetry={() => void state.load()}
        empty={{
          action:
            <Button asChild variant="outline">
              <Link
                href={`/facilities/new?category=${encodeURIComponent(state.category)}`}
                prefetch={false}
              >
                <Plus />{translate('ui.facility.createFirst')}</Link>
            </Button>
          ,
          description:
            state.committedQuery
              ? translate('ui.facility.emptySearch', { query: state.committedQuery })
              : translate('ui.facility.emptyCategory')
          ,
          title: translate('ui.facility.emptyTitle'),
        }}
        renderItem={(facility) => (
              <FacilityCard
                affecting={state.isAffecting(facility.id)}
                burst={state.affectBurstById[facility.id] ?? 0}
                facility={facility}
                onToggleAffected={() => void state.toggleAffected(facility.id)}
                profile={profiles[facility.author_uid]}
                reveal={state.revealFields}
              />
        )}
      />
      {state.feed.hasMore ? (
        <div className="flex justify-center pt-2">
          <Button
            disabled={state.loadingMore}
            onClick={() => void state.load(state.feed.cursor)}
            variant="outline"
          >
            <ArrowDown />
            {state.loadingMore ? translate('ui.common.loadingMore') : translate('ui.common.loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
