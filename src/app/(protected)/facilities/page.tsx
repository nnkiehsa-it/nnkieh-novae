"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import Link from "next/link";
import { ArrowDown, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import type { FacilitySortOption } from "@/types";
import { useFacilityFeed } from "@/hooks/use-facility-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
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
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/components/ui/page-state";
import { FeedCardsSkeleton } from "@/components/ui/route-skeleton";
import { FacilityCard } from "@/components/facilities/facility-card";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";

export default function FacilitiesPage() {
  useLocaleSubscription();
  const state = useFacilityFeed();
  const profiles = usePublicProfiles(
    state.feed.facilities.map((facility) => facility.author_uid),
  );

  return (
    <div className="t-reveal-content space-y-5">
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
              className="h-auto max-w-full border-0 bg-transparent p-0 text-2xl font-semibold leading-8 shadow-none"
            >
              <SelectValue>{translate('ui.facility.title')}</SelectValue>
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
      <Card className="gap-0 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-8"
              onChange={(event) => state.setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") state.setCommittedQuery(state.query.trim());
              }}
              placeholder={translate('ui.facility.searchPlaceholder')}
              value={state.query}
            />
            {state.query ? (
              <button
                aria-label={translate('ui.common.clearSearch')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground"
                onClick={() => {
                  state.setQuery("");
                  state.setCommittedQuery("");
                }}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <Select
            onValueChange={(value) => state.setSort(value as FacilitySortOption)}
            value={state.sort}
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
              <SelectItem value="most-affected">{translate('ui.facility.mostAffected')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>
      {state.error && state.feed.facilities.length === 0 ? (
        <ErrorState error={state.error} onRetry={() => void state.load()} />
      ) : state.loading && state.feed.facilities.length === 0 ? (
        <FeedCardsSkeleton kind="facility" />
      ) : state.feed.facilities.length === 0 ? (
        <EmptyState
          action={
            <Button asChild variant="outline">
              <Link
                href={`/facilities/new?category=${encodeURIComponent(state.category)}`}
              >
                <Plus />{translate('ui.facility.createFirst')}</Link>
            </Button>
          }
          description={
            state.committedQuery
              ? translate('ui.facility.emptySearch', { query: state.committedQuery })
              : translate('ui.facility.emptyCategory')
          }
          title={translate('ui.facility.emptyTitle')}
        />
      ) : (
        <StaggerList
          className="grid gap-3 lg:grid-cols-2 lg:items-stretch"
          key={`${state.category}:${state.bucket}:${state.sort}:${state.committedQuery}`}
        >
          {state.feed.facilities.map((facility) => (
            <StaggerItem className="h-full" key={facility.id}>
              <FacilityCard
                affecting={state.affectingId === facility.id}
                burst={state.affectBurstById[facility.id] ?? 0}
                facility={facility}
                onToggleAffected={() => void state.toggleAffected(facility.id)}
                profile={profiles[facility.author_uid]}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      )}
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
