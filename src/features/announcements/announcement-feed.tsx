"use client";

import { AppLink } from "@/ui/app-link";
import { Plus } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { useAnnouncementFeed } from "@/hooks/use-announcement-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { FeedTopBar } from "@/features/feed/feed-controls";
import { FeedList } from "@/features/feed/feed-list";
import { Button } from "@/ui/button";
import { AnnouncementCard } from "./announcement-card";

const COMPOSE_HREF = "/announcements/new";

export function AnnouncementFeed({ notice, viewSwitch }: { notice?: React.ReactNode; viewSwitch: React.ReactNode }) {
  const { t } = useI18n();
  const feed = useAnnouncementFeed();
  const profiles = usePublicProfiles(feed.items.map((announcement) => announcement.authorUid));
  return (
    <div className="grid gap-5">
      <FeedTopBar
        center={viewSwitch}
        right={feed.canManage ? (
          <Button aria-label={t("ui.announcement.new")} asChild size="icon">
            <AppLink href={COMPOSE_HREF}><Plus weight="bold" /></AppLink>
          </Button>
        ) : null}
      />
      {notice}
      <FeedList
        empty={{
          action: feed.canManage
            ? <Button asChild><AppLink href={COMPOSE_HREF}><Plus weight="bold" />{t("ui.announcement.createFirst")}</AppLink></Button>
            : undefined,
          description: t("ui.announcement.emptyDescription"),
          title: t("ui.announcement.emptyTitle"),
        }}
        error={feed.error}
        hasMore={feed.hasMore}
        items={feed.items}
        loading={feed.loading}
        loadingMore={feed.loadingMore}
        onLoadMore={feed.loadMore}
        onRetry={feed.reload}
        renderItem={(announcement) => (
          <AnnouncementCard
            announcement={announcement}
            burst={feed.likeBurstById[announcement.id] ?? 0}
            liking={feed.isLiking(announcement.id)}
            onLike={() => void feed.like(announcement.id)}
            profile={profiles[announcement.authorUid]}
          />
        )}
      />
    </div>
  );
}
