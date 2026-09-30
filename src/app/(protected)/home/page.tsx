import { Suspense } from "react";
import { HomeOverview } from "@/components/home/home-overview";

export default function HomePage() {
  return <Suspense><HomeOverview /></Suspense>;
}
