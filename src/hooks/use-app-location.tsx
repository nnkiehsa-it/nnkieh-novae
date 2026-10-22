import * as React from "react";
import { useLocation } from "react-router";
import { navigate } from "@/lib/app-navigation";
import { matchAppRoute, type AppRoute } from "@/lib/route-hierarchy";

export interface AppLocation {
  pathname: string;
  search: URLSearchParams;
}

const AppLocationContext = React.createContext<AppLocation | null>(null);

/**
 * Pins the address a screen reads. The list under an open record keeps
 * reading the address it was opened at, and a closing record keeps its own
 * until it has left.
 */
export function AppLocationProvider({ children, value }: { children: React.ReactNode; value: AppLocation }) {
  return <AppLocationContext.Provider value={value}>{children}</AppLocationContext.Provider>;
}

/** The address this screen is drawn for. */
export function useAppLocation(): AppLocation {
  const pinned = React.useContext(AppLocationContext);
  const browser = useBrowserLocation();
  return pinned ?? browser;
}

/**
 * The id of the record this screen is drawn for, read from its address.
 * Throws on a screen that is not that kind of record, which is a wiring bug.
 */
export function useRecordId<Kind extends "announcement" | "facility" | "issue">(kind: Kind) {
  const route = matchAppRoute(useAppLocation().pathname);
  if (route.kind !== kind) throw new Error(`Expected a ${kind} address, got ${route.kind}`);
  return route as Extract<AppRoute, { kind: Kind }>;
}

/** Goes to `href`: in place on this origin, as a page load otherwise. */
export function useAppNavigate() {
  return React.useCallback((href: string, options: { replace?: boolean } = {}) => {
    if (navigate(href, options)) return;
    if (options.replace) window.location.replace(href);
    else window.location.assign(href);
  }, []);
}

/** The current address as the browser shows it, for the view host to pin. */
export function useBrowserLocation(): AppLocation & { key: string } {
  const { pathname, search } = useLocation();
  return React.useMemo(() => {
    const query = new URLSearchParams(search).toString();
    return { key: query ? `${pathname}?${query}` : pathname, pathname, search: new URLSearchParams(query) };
  }, [pathname, search]);
}
