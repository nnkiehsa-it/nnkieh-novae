"use client";

import { CircleCheck, CircleDot } from "lucide-react";
import { useI18n } from "@/i18n";
import { useIssueFeed } from "@/hooks/use-issue-feed";
import { ISSUE_BUCKET_STATUSES } from "@/constants/statuses";
import { ListNavRow, ListSection } from "@/components/ui/list";
import { ErrorState } from "@/components/ui/page-state";
import { Skeleton } from "@/components/ui/skeleton";

export function HomeProposals() {
  const { t } = useI18n();
  const { feed, loading, error, load } = useIssueFeed("my-proposals");
  const count = (bucket: "active" | "closed") => loading
    ? <Skeleton className="h-5 w-8" />
    : ISSUE_BUCKET_STATUSES[bucket].reduce((total, status) => total + feed.statusCounts[status], 0);
  return (
    <ListSection header={t("ui.issue.mine")}>
      {error ? <ErrorState error={error} onRetry={() => void load(null, true)} /> : <>
        <ListNavRow href="/feed?category=my-proposals" icon={CircleDot} label={t("ui.common.active")} value={count("active")} />
        <ListNavRow href="/feed?category=my-proposals&bucket=closed" icon={CircleCheck} label={t("ui.common.closed")} value={count("closed")} />
      </>}
    </ListSection>
  );
}
