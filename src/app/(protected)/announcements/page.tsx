"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import Link from "next/link";
import { ArrowDown, Plus } from "lucide-react";
import { useAnnouncementFeed } from "@/hooks/use-announcement-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
} from "@/components/ui/page-state";
import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { FeedList } from "@/components/ui/feed-list";

export default function AnnouncementsPage() {
  useLocaleSubscription();
  const feed = useAnnouncementFeed();
  const profiles = usePublicProfiles(
    feed.items.map((announcement) => announcement.author_uid),
  );
  return (
    <div className="space-y-5">
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
      <FeedList
        kind="announcement"
        items={feed.items}
        loading={feed.loading}
        error={feed.error}
        onRetry={() => void feed.load()}
        empty={{
          action:
            feed.canManage ? (
              <Button asChild variant="outline">
                <Link href="/announcements/new">
                  <Plus />{translate('ui.announcement.createFirst')}</Link>
              </Button>
            ) : undefined
          ,
          description: translate('ui.announcement.emptyDescription'),
          title: translate('ui.announcement.emptyTitle'),
        }}
        renderItem={(announcement) => (
              <AnnouncementCard
                announcement={announcement}
                burst={feed.likeBurstById[announcement.id] ?? 0}
                liking={feed.likingId === announcement.id}
                onLike={() => void feed.like(announcement.id)}
                profile={profiles[announcement.author_uid]}
                reveal={feed.revealFields}
              />
        )}
      />
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
