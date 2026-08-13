"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCategories } from "@/hooks/use-categories";

export function FeatureRouteGuard({
  children,
  feature,
}: {
  children: ReactNode;
  feature: "facilities" | "issues";
}) {
  const router = useRouter();
  const categories = useCategories();
  const enabled =
    feature === "issues"
      ? categories.issuesEnabled
      : categories.facilitiesEnabled;

  useEffect(() => {
    if (categories.loaded && !enabled) router.replace("/announcements");
  }, [categories.loaded, enabled, router]);

  return categories.loaded && !enabled ? null : children;
}
