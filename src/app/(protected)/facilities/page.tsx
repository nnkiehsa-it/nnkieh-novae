"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import Link from "next/link";
import { ArrowDown, CircleCheck, CircleDot, Plus } from "lucide-react";
import type { FacilitySortOption } from "@/types";
import { useFacilityFeed } from "@/hooks/use-facility-feed";
import { FACILITY_BUCKET_STATUSES, FACILITY_STATUS_LABELS } from "@/constants/statuses";
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
import { StatusDistribution } from "@/components/ui/status-distribution";
import { statusFillColor, statusTextColor } from "@/components/ui/status-badge";

export default function FacilitiesPage() {
  useLocaleSubscription();
  const state = useFacilityFeed();
  const profiles = usePublicProfiles(
    state.feed.facilities.map((facility) => facility.author_uid),
  );

  const statusSegments = FACILITY_BUCKET_STATUSES[state.bucket].map((status) => ({
    color: statusTextColor(status),
    count: state.feed.statusCounts[status],
    fill: statusFillColor(status),
    key: status,
    label: translate(FACILITY_STATUS_LABELS[status]),
  }));
  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            <Button asChild className="order-3 ml-auto sm:order-2 sm:ml-0" size="adaptive">
              <Link
                aria-label={translate('ui.facility.new')}
                href={`/facilities/new?category=${encodeURIComponent(state.category)}`}
              >
                <Plus /><span className="hidden sm:inline">{translate('ui.facility.new')}</span></Link>
            </Button>
            <LiquidTabs
              className="order-2 sm:order-3"
              ariaLabel={translate('ui.facility.statusFilter')}
              compact
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
          </>
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
        toolbar={
          <FeedToolbar
            className="order-4"
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
      <StatusDistribution
        ariaLabel={translate('ui.facility.statusCounts')}
        loading={state.loading}
        segments={statusSegments}
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
