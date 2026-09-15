"use client";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { FacilityDetail } from "@/components/facilities/facility-detail";
import { DetailModal } from "@/components/detail-modal";

export default function Page() {
  useLocaleSubscription();
  return (
    <DetailModal label={translate("ui.nav.facilities")}>
      <FacilityDetail />
    </DetailModal>
  );
}
