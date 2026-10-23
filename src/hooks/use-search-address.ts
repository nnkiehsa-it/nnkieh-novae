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
  const pending = usePendingAddress();
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

/**
 * React Router draws a committed address in a transition, so the request is
 * let go in one too and both draw together. Letting go first would show the
 * address being left for a render and remount whatever is keyed by it; an
 * external store cannot wait like that, since its updates always draw at once.
 */
function usePendingAddress() {
  const [pending, setPending] = React.useState(pendingAddress);
  React.useEffect(() => {
    const follow = () => {
      const next = pendingAddress();
      if (next === null) React.startTransition(() => setPending(null));
      else setPending(next);
    };
    follow();
    return subscribePendingAddress(follow);
  }, []);
  return pending;
}
