import * as React from "react";

/** Below the `md` breakpoint: phones, where menus become sheets and the dock replaces the rail. */
const COMPACT_QUERY = "(max-width: 47.99rem)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useCompactViewport() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false,
  );
}
