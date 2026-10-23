import * as React from "react";
import { useAppLocation } from "@/hooks/use-app-location";
import { pushAddress, replaceAddress } from "@/lib/app-navigation";

/**
 * Query parameters a screen both reads and writes, such as the open tab.
 *
 * A write shows on the next render, before the router has committed the
 * address: a control that waited for the router would answer a beat late, and
 * anything keyed by the choice would remount after the reader had already
 * started typing into it. Once the address changes, for this write or a step
 * back, the URL rules again.
 */
export function useSearchAddress() {
  const location = useAppLocation();
  const current = location.search.toString();
  const [pending, setPending] = React.useState<{ from: string; search: URLSearchParams } | null>(null);
  if (pending && pending.from !== current) setPending(null);
  const search = pending?.from === current ? pending.search : location.search;
  const write = React.useCallback((address: string, replace = false) => {
    setPending({ from: current, search: new URL(address, window.location.origin).searchParams });
    if (replace) replaceAddress(address);
    else pushAddress(address);
  }, [current]);
  return [search, write] as const;
}
