"use client";

import { useI18n } from "@/i18n";
import { feedHref } from "@/lib/feed-href";
import { RecordRoute } from "@/features/content/record-route";
import { AnnouncementComposer } from "./announcement-composer";
import { AnnouncementDetail } from "./announcement-detail";

const LIST_HREF = feedHref("announcements");

export function AnnouncementRecordRoute({ sheet = false }: { sheet?: boolean }) {
  const { t } = useI18n();
  return (
    <RecordRoute listHref={LIST_HREF} sheet={sheet} title={t("ui.nav.announcements")}>
      <AnnouncementDetail />
    </RecordRoute>
  );
}

export function AnnouncementComposerRoute() {
  const { t } = useI18n();
  return (
    <RecordRoute listHref={LIST_HREF} title={t("ui.announcement.newTitle")}>
      <AnnouncementComposer />
    </RecordRoute>
  );
}
