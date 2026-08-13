import type { ReactNode } from "react";
import { FeatureRouteGuard } from "@/components/feature-route-guard";

export default function FacilitiesLayout({ children }: { children: ReactNode }) {
  return <FeatureRouteGuard feature="facilities">{children}</FeatureRouteGuard>;
}
