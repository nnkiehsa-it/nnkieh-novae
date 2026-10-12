/** A facility report's own address, keeping the category its list is in. */
export function facilityHref(facility: { category_id: string; id: string }) {
  return `/facilities/${facility.id}?category=${encodeURIComponent(facility.category_id)}`;
}

export function facilityComposeHref(category: string) {
  return `/facilities/new?category=${encodeURIComponent(category)}`;
}
