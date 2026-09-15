"use client";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { IssueDetail } from "@/components/issues/issue-detail";
import { DetailModal } from "@/components/detail-modal";

export default function Page() {
  useLocaleSubscription();
  return (
    <DetailModal label={translate("ui.nav.issues")}>
      <IssueDetail />
    </DetailModal>
  );
}
