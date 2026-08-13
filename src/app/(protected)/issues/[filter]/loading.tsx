"use client";

import { useParams } from "next/navigation";
import { getIssueCategoryLabel } from "@/constants/categories";
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
      title={title}
    />
  );
}
