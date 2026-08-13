"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import Link from "next/link";
import { ArrowDown, Plus } from "lucide-react";
import { useAnnouncementFeed } from "@/hooks/use-announcement-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/components/ui/page-state";
import { FeedCardsSkeleton } from "@/components/ui/route-skeleton";
import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";

export default function AnnouncementsPage() {
  useLocaleSubscription();
  const feed = useAnnouncementFeed();
  const profiles = usePublicProfiles(
    feed.items.map((announcement) => announcement.author_uid),
  );
  return (
    <div className="t-reveal-content space-y-5">
      <PageHeader
        actions={
          feed.canManage ? (
            <Button asChild>
              <Link href="/announcements/new">
                <Plus />{translate('ui.announcement.new')}</Link>
            </Button>
          ) : null
        }
        title={translate('ui.nav.announcements')}
      />
      {feed.error && feed.items.length === 0 ? (
        <ErrorState error={feed.error} onRetry={() => void feed.load()} />
      ) : feed.loading && feed.items.length === 0 ? (
        <FeedCardsSkeleton kind="announcement" />
      ) : feed.items.length === 0 ? (
        <EmptyState
          action={
            feed.canManage ? (
              <Button asChild variant="outline">
                <Link href="/announcements/new">
                  <Plus />{translate('ui.announcement.createFirst')}</Link>
              </Button>
            ) : undefined
          }
          description={translate('ui.announcement.emptyDescription')}
          title={translate('ui.announcement.emptyTitle')}
        />
      ) : (
        <StaggerList className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
          {feed.items.map((announcement) => (
            <StaggerItem className="h-full" key={announcement.id}>
              <AnnouncementCard
                announcement={announcement}
                burst={feed.likeBurstById[announcement.id] ?? 0}
                liking={feed.likingId === announcement.id}
                onLike={() => void feed.like(announcement.id)}
                profile={profiles[announcement.author_uid]}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      )}
      {feed.hasMore ? (
        <div className="flex justify-center">
          <Button
            disabled={feed.loadingMore}
            onClick={() => void feed.load(feed.cursor)}
            variant="outline"
          >
            <ArrowDown />
            {feed.loadingMore ? translate('ui.common.loadingMore') : translate('ui.common.loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
