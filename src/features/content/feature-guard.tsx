import { useEffect, type ReactNode } from "react";
import { useAppNavigate } from "@/hooks/use-app-location";
import { feedHref } from "@/lib/feed-href";
import { useCategories } from "@/hooks/use-categories";

export function FeatureRouteGuard({
  children,
  feature,
}: {
  children: ReactNode;
  feature: "facilities" | "issues";
}) {
  const navigate = useAppNavigate();
  const categories = useCategories();
  const enabled =
    feature === "issues"
      ? categories.issuesEnabled
      : categories.facilitiesEnabled;

  useEffect(() => {
    if (categories.loaded && !enabled) navigate(feedHref("announcements"), { replace: true });
  }, [categories.loaded, enabled, navigate]);

  return categories.loaded && !enabled ? null : children;
}
