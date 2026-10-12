"use client";

import { useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";
import { feedHref } from "@/lib/feed-href";
import { RecordRoute } from "@/features/content/record-route";
import { FacilityComposer } from "./facility-composer";
import { FacilityDetail } from "./facility-detail";

function useFacilityListHref() {
  return feedHref("facilities", useSearchParams().get("category"));
}

export function FacilityRecordRoute({ sheet = false }: { sheet?: boolean }) {
  const { t } = useI18n();
  return (
    <RecordRoute feature="facilities" listHref={useFacilityListHref()} sheet={sheet} title={t("ui.nav.facilities")}>
      <FacilityDetail />
    </RecordRoute>
  );
}

export function FacilityComposerRoute() {
  const { t } = useI18n();
  return (
    <RecordRoute feature="facilities" listHref={useFacilityListHref()} title={t("ui.facility.newTitle")}>
      <FacilityComposer />
    </RecordRoute>
  );
}
