"use client";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { AnnouncementDetail } from "@/components/announcements/announcement-detail";
import { DetailModal } from "@/components/detail-modal";

export default function Page() {
  useLocaleSubscription();
  return (
    <DetailModal label={translate("ui.nav.announcements")}>
      <AnnouncementDetail />
    </DetailModal>
  );
}
