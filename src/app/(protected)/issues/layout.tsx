import type { ReactNode } from "react";
import { FeatureRouteGuard } from "@/components/feature-route-guard";

export default function IssuesLayout({ children }: { children: ReactNode }) {
  return <FeatureRouteGuard feature="issues">{children}</FeatureRouteGuard>;
}
