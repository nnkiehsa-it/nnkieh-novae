"use client";

import { useParams } from "next/navigation";
import { getIssueCategoryLabel, getIssueSupportGoal, issueAllowsSupport } from "@/constants/categories";
import { t } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { ListRouteSkeleton } from "@/components/ui/route-skeleton";

export default function Loading() {
  const params = useParams<{ filter: string }>();
  useCategories();
  const filter = decodeURIComponent(params.filter);
  const title =
    filter === "my-proposals"
      ? t("ui.issue.mine")
      : getIssueCategoryLabel(filter) || t("ui.nav.issues");
  return (
    <ListRouteSkeleton
      kind="issue"
      showCreate={filter !== "my-proposals"}
      showProgress={filter === "my-proposals" || (issueAllowsSupport(filter) && Boolean(getIssueSupportGoal(filter)))}
      title={title}
    />
  );
}
