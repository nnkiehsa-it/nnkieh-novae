"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ensureCategoryCatalog,
  getDefaultIssueCategoryId,
} from "@/hooks/use-categories";

export default function IssueEntryPage() {
  const router = useRouter();
  React.useEffect(() => {
    void ensureCategoryCatalog()
      .then(() => {
        router.replace(
          `/issues/${encodeURIComponent(getDefaultIssueCategoryId() || "my-proposals")}`,
        );
      })
      .catch(() => undefined);
  }, [router]);
  return <div className="t-skeleton h-52 rounded-2xl bg-muted" />;
}
