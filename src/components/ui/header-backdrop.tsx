/** A paint-only sibling behind header content, never a filter on the title. */
export function HeaderBackdrop({ progressive = false }: { progressive?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="header-backdrop"
      data-progressive={progressive || undefined}
      data-slot="header-backdrop"
    >
      {progressive ? (
        <>
          <span data-blur-step="strong" />
          <span data-blur-step="medium" />
          <span data-blur-step="soft" />
        </>
      ) : null}
    </span>
  );
}
