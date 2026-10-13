"use client";

import { AppLink } from "@/ui/app-link";
import { Megaphone } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { useAnnouncementNotice } from "@/hooks/use-announcement-notice";
import { feedHref } from "@/lib/feed-href";
import { Button } from "@/ui/button";

/** A pill that appears while there is an announcement the reader has not opened. */
export function AnnouncementNotice() {
  const { t } = useI18n();
  const unread = useAnnouncementNotice();
  if (!unread) return null;
  return (
    <Button asChild variant="primary">
      <AppLink aria-label={t("ui.announcement.noticeLabel")} href={feedHref("announcements")}>
        <Megaphone weight="fill" />
        <span className="sm:hidden">{t("ui.announcement.noticeShort")}</span>
        <span className="max-sm:hidden">{t("ui.announcement.noticeLabel")}</span>
      </AppLink>
    </Button>
  );
}
