import type { ReactNode } from "react";
import { FeatureRouteGuard } from "@/components/feature-route-guard";

/** The list, and whatever is shown over it, behind the one feature gate. */
export default function FacilitiesLayout({
  children,
  sheet,
}: {
  children: ReactNode;
  sheet: ReactNode;
}) {
  return (
    <FeatureRouteGuard feature="facilities">
      {children}
      {sheet}
    </FeatureRouteGuard>
  );
}
