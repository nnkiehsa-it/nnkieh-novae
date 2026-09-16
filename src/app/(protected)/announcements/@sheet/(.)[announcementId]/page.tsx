"use client";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { AnnouncementDetail } from "@/components/announcements/announcement-detail";
import { DetailSheet } from "@/components/detail-sheet";

export default function Page() {
  useLocaleSubscription();
  return (
    <DetailSheet label={translate("ui.nav.announcements")}>
      <AnnouncementDetail />
    </DetailSheet>
  );
}
