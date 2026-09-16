/** A paint-only sibling behind header content, never a filter on the title. */
export function HeaderBackdrop() {
  return <span aria-hidden="true" className="header-backdrop" data-slot="header-backdrop" />;
}
