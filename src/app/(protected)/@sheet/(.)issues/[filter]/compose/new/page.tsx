"use client";

import { DetailSheet } from "@/components/detail-sheet";
import { FeatureRouteGuard } from "@/components/feature-route-guard";
import { IssueComposer } from "@/components/issues/issue-composer";
import { useI18n } from "@/i18n";

export default function Page() {
  const { t } = useI18n();

  return (
    <FeatureRouteGuard feature="issues">
      <DetailSheet label={t("ui.issue.new")} overlayLabel={null}>
        <IssueComposer />
      </DetailSheet>
    </FeatureRouteGuard>
  );
}
