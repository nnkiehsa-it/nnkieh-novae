export type FeedView = "issues" | "facilities" | "announcements";

/** The feed showing one kind of record, optionally narrowed to a category. */
export function feedHref(view: FeedView, category?: string | null) {
  const params = new URLSearchParams({ view });
  if (category) params.set("category", category);
  return `/feed?${params.toString()}`;
}
