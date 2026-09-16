import type { ReactNode } from "react";
import { FeatureRouteGuard } from "@/components/feature-route-guard";

/** Direct facility routes share the feature gate; intercepted records carry it too. */
export default function FacilitiesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <FeatureRouteGuard feature="facilities">
      {children}
    </FeatureRouteGuard>
  );
}
