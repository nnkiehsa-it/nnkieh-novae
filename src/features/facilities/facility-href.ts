/** A facility report's own address, keeping the category its list is in. */
export function facilityHref(facility: { categoryId: string; id: string }) {
  return `/facilities/${facility.id}?category=${encodeURIComponent(facility.categoryId)}`;
}

export function facilityComposeHref(category: string) {
  return `/facilities/new?category=${encodeURIComponent(category)}`;
}
