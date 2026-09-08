"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import Link from "next/link";
import { ArrowDown, Plus } from "lucide-react";
import type { FacilitySortOption } from "@/types";
import { useFacilityFeed } from "@/hooks/use-facility-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
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
import {
  PageHeader,
} from "@/components/ui/page-state";
import { FacilityCard } from "@/components/facilities/facility-card";
import { FeedList } from "@/components/ui/feed-list";

export default function FacilitiesPage() {
  useLocaleSubscription();
  const state = useFacilityFeed();
  const profiles = usePublicProfiles(
    state.feed.facilities.map((facility) => facility.author_uid),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <div className="flex w-full items-center gap-2">
            <Button asChild>
              <Link
                href={`/facilities/new?category=${encodeURIComponent(state.category)}`}
              >
                <Plus />{translate('ui.facility.new')}</Link>
            </Button>
            <LiquidTabs
              className="ml-auto"
              ariaLabel={translate('ui.facility.statusFilter')}
              onValueChange={(value) => {
                state.setBucket(value as "active" | "closed");
                state.setStatus("");
              }}
              options={[
                { label: translate('ui.status.processing'), value: "active" },
                { label: translate('ui.common.closed'), value: "closed" },
              ]}
              value={state.bucket}
            />
          </div>
        }
        title={
          <Select onValueChange={state.changeCategory} value={state.category}>
            <SelectTrigger
              aria-label={translate('ui.access.selectCategory')}
              data-control-label="heading"
              className="h-auto max-w-full border-0 bg-transparent p-0 text-2xl font-semibold leading-8 shadow-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {state.categories.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <FeedToolbar
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
                affecting={state.affectingId === facility.id}
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
