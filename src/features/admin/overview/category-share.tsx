"use client";

import { getIssueCategoryLabel } from "@/constants/categories";
import { useI18n } from "@/i18n";
import { Panel, SectionTitle } from "@/ui/panel";
import type { PlatformDashboardData } from "@/types";
import { ShareBar } from "../shared/share-bar";

/** Where the proposals actually are, as a share of the whole. */
export function CategoryShare({ platform }: { platform: PlatformDashboardData | null }) {
  const { t } = useI18n();
  const byCategory = platform?.stats.issues_by_category;
  const segments = Object.entries(byCategory ?? {})
    .toSorted((left, right) => right[1] - left[1])
    .map(([category, count]) => ({ count, key: category, label: getIssueCategoryLabel(category) }));
  if (byCategory && segments.every((segment) => segment.count === 0)) return null;
  return (
    <section className="grid gap-2">
      <SectionTitle>{t("ui.dashboard.categoryDistribution")}</SectionTitle>
      <Panel>
        <ShareBar label={t("ui.dashboard.categoryDistribution")} loading={!byCategory} segments={segments} />
      </Panel>
    </section>
  );
}
