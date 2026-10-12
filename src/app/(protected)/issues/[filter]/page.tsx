import { redirect } from "next/navigation";
import { feedHref } from "@/lib/feed-href";

/** Proposal lists live in the feed; this address forwards there. */
export default async function Page({ params }: { params: Promise<{ filter: string }> }) {
  redirect(feedHref("issues", decodeURIComponent((await params).filter)));
}
