"use client";

import { useRouter } from "next/navigation";
import { Icon } from "framework7-react";
import { useI18n } from "@/i18n";
import { useAnnouncementNotice } from "@/hooks/use-announcement-notice";
import { ToolbarButton } from "@/components/ui/toolbar-button";

export function AnnouncementNotice() {
  const { t } = useI18n();
  const unread = useAnnouncementNotice();
  const router = useRouter();
  if (!unread) return null;

  return (
    <ToolbarButton
      aria-label={t("ui.announcement.noticeLabel")}
      onClick={() => router.push("/announcements")}
    >
      <Icon f7="speaker_2" aria-hidden="true" />
    </ToolbarButton>
  );
}
