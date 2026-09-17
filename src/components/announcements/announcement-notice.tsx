"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";
import { useI18n } from "@/i18n";
import { useAnnouncementNotice } from "@/hooks/use-announcement-notice";
import { Button } from "@/components/ui/button";

export function AnnouncementNotice() {
  const { t } = useI18n();
  const unread = useAnnouncementNotice();
  if (!unread) return null;

  return (
    <Button
      asChild
      className="rounded-full border-transparent bg-[var(--announcement-notice-bg)] text-[var(--announcement-notice-fg)] shadow-none hover:bg-[var(--announcement-notice-hover)] hover:text-[var(--announcement-notice-fg)]"
    >
      <Link
        aria-label={t("ui.announcement.noticeLabel")}
        href="/announcements"
        prefetch
      >
        <Megaphone />
        <span className="sm:hidden">{t("ui.announcement.noticeShort")}</span>
        <span className="hidden sm:inline">{t("ui.announcement.noticeLabel")}</span>
      </Link>
    </Button>
  );
}
