"use client";

import { useI18n } from "@/i18n";
import { IssueDetail } from "@/components/issues/issue-detail";
import { FeatureRouteGuard } from "@/components/feature-route-guard";
import { DetailSheet } from "@/components/detail-sheet";

export default function Page() {
  const { t } = useI18n();
  return (
    <FeatureRouteGuard feature="issues">
      <DetailSheet label={t("ui.nav.issues")}>
        <IssueDetail />
      </DetailSheet>
    </FeatureRouteGuard>
  );
}
