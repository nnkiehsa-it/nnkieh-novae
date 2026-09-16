"use client";

import { useI18n } from "@/i18n";
import { FacilityDetail } from "@/components/facilities/facility-detail";
import { FeatureRouteGuard } from "@/components/feature-route-guard";
import { DetailSheet } from "@/components/detail-sheet";

export default function Page() {
  const { t } = useI18n();
  return (
    <FeatureRouteGuard feature="facilities">
      <DetailSheet label={t("ui.nav.facilities")}>
        <FacilityDetail />
      </DetailSheet>
    </FeatureRouteGuard>
  );
}
