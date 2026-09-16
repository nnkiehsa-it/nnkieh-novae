"use client";

import { useI18n } from "@/i18n";
import { AnnouncementDetail } from "@/components/announcements/announcement-detail";
import { DetailSheet } from "@/components/detail-sheet";

export default function Page() {
  const { t } = useI18n();
  return (
    <DetailSheet label={t("ui.nav.announcements")}>
      <AnnouncementDetail />
    </DetailSheet>
  );
}
