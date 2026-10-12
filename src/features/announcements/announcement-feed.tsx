"use client";

import Link from "next/link";
import { Plus } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { useAnnouncementFeed } from "@/hooks/use-announcement-feed";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { FeedList } from "@/features/feed/feed-list";
import { Button } from "@/ui/button";
import { AnnouncementCard } from "./announcement-card";

const COMPOSE_HREF = "/announcements/new";

export function AnnouncementFeed() {
  const { t } = useI18n();
  const feed = useAnnouncementFeed();
  const profiles = usePublicProfiles(feed.items.map((announcement) => announcement.author_uid));
  return (
    <div className="grid gap-5">
      {feed.canManage ? (
        <Button asChild className="justify-self-end" variant="primary">
          <Link href={COMPOSE_HREF} prefetch={false}><Plus weight="bold" />{t("ui.announcement.new")}</Link>
        </Button>
      ) : null}
      <FeedList
        empty={{
          action: feed.canManage
            ? <Button asChild><Link href={COMPOSE_HREF} prefetch={false}><Plus weight="bold" />{t("ui.announcement.createFirst")}</Link></Button>
            : undefined,
          description: t("ui.announcement.emptyDescription"),
          title: t("ui.announcement.emptyTitle"),
        }}
        error={feed.error}
        hasMore={feed.hasMore}
        items={feed.items}
        loading={feed.loading}
        loadingMore={feed.loadingMore}
        onLoadMore={() => void feed.load(feed.cursor)}
        onRetry={() => void feed.load()}
        renderItem={(announcement) => (
          <AnnouncementCard
            announcement={announcement}
            burst={feed.likeBurstById[announcement.id] ?? 0}
            liking={feed.isLiking(announcement.id)}
            onLike={() => void feed.like(announcement.id)}
            profile={profiles[announcement.author_uid]}
          />
        )}
      />
    </div>
  );
}
