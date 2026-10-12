import { redirect } from "next/navigation";
import { feedHref } from "@/lib/feed-href";

/** Facility reports live in the feed; this address forwards there. */
export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const { category } = await searchParams;
  redirect(feedHref("facilities", typeof category === "string" ? category : null));
}
