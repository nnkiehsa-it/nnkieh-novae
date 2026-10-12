import { Suspense } from "react";
import { FacilityComposerRoute } from "@/features/facilities/facility-routes";

export default function Page() {
  return <Suspense><FacilityComposerRoute /></Suspense>;
}
