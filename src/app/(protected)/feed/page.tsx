import { Suspense } from "react";
import { FeedPage } from "@/features/feed/feed-page";

export default function Page() {
  return <Suspense><FeedPage /></Suspense>;
}
