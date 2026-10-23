import * as React from "react";
import { useAppLocation } from "@/hooks/use-app-location";
import { pendingAddress, pushAddress, replaceAddress, subscribePendingAddress } from "@/lib/app-navigation";

/**
 * Query parameters a screen both reads and writes, such as the open tab.
 *
 * A write shows on the next render, before the router has committed the
 * address: a control that waited for the router would answer a beat late, and
 * anything keyed by the choice would remount after the reader had already
 * started typing into it. Every screen reads the same pending address, so
 * quick writes from different controls add up, and the first commit, the
 * write's own or a step back, hands control back to the URL.
 */
export function useSearchAddress() {
  const location = useAppLocation();
  const pending = React.useSyncExternalStore(subscribePendingAddress, pendingAddress, pendingAddress);
  const search = React.useMemo(() => {
    if (!pending) return location.search;
    const url = new URL(pending, window.location.origin);
    return url.pathname === location.pathname ? url.searchParams : location.search;
  }, [location.pathname, location.search, pending]);
  const write = React.useCallback((address: string, replace = false) => {
    if (replace) replaceAddress(address);
    else pushAddress(address);
  }, []);
  return [search, write] as const;
}
