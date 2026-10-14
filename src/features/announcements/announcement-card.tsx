"use client";

import { ChatCircle, Heart } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import type { AnnouncementSummary, UserPublicProfile } from "@/types";
import { formatRelativeTime } from "@/lib/format";
import { Author } from "@/features/content/person";
import { ReactionButton } from "@/features/content/reaction";
import { RecordCard } from "@/features/feed/record-card";
import { AnimatedNumber } from "@/ui/animated-number";
import { Chip } from "@/ui/chip";

export function AnnouncementCard({ announcement, burst, liking, onLike, profile }: {
  announcement: AnnouncementSummary;
  burst: number;
  liking: boolean;
  onLike: () => void;
  profile?: UserPublicProfile;
}) {
  const { t } = useI18n();
  return (
    <RecordCard
      chips={<Chip>{t("ui.announcement.badge")}</Chip>}
      footer={
        <>
          <ReactionButton
            active={announcement.currentUserLiked === true}
            burst={burst}
            busy={liking}
            count={announcement.likeCount}
            icon={Heart}
            label={t(announcement.currentUserLiked ? "ui.announcement.liked" : "ui.announcement.like")}
            onClick={onLike}
          />
          <span aria-label={t("comments.viewComments")} className="ml-auto inline-flex items-center gap-1.5 text-sm tabular-nums text-ink-muted">
            <ChatCircle aria-hidden className="size-5" />
            <AnimatedNumber value={announcement.commentCount} />
          </span>
        </>
      }
      href={`/announcements/${announcement.id}`}
      label={announcement.title}
      meta={
        <>
          <Author profile={profile} />
          <span aria-hidden>·</span>
          <span>{formatRelativeTime(announcement.publishedAt)}</span>
        </>
      }
      title={announcement.title}
    />
  );
}
