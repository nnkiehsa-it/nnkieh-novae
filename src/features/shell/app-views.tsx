import * as React from "react";
import { useOutlet } from "react-router";
import { motion } from "motion/react";
import { useI18n } from "@/i18n";
import { AppLocationProvider, useBrowserLocation, type AppLocation } from "@/hooks/use-app-location";
import { navigate } from "@/lib/app-navigation";
import { feedHref } from "@/lib/feed-href";
import { timing } from "@/lib/motion-timing";
import { isLayeredRoute, matchAppRoute, type AppRoute } from "@/lib/route-hierarchy";
import { FeatureRouteGuard } from "@/features/content/feature-guard";
import { RecordSheet } from "@/features/content/record-frame";

/** An address held on screen, with the screen its route drew for it. */
interface Pinned extends AppLocation {
  element: React.ReactNode;
  key: string;
  route: AppRoute;
}

/** The feed, for a record opened straight from its address with no list drawn yet. */
const FeedScreen = React.lazy(async () => ({ default: (await import("@/features/feed/feed-page")).FeedPage }));

function pin(location: AppLocation & { key: string }, element: React.ReactNode): Pinned {
  return { ...location, element, route: matchAppRoute(location.pathname) };
}

function pinHref(href: string, element: React.ReactNode): Pinned {
  const url = new URL(href, "http://novae.invalid");
  return pin({ key: href, pathname: url.pathname, search: url.searchParams }, element);
}

/** The list a record or composer belongs to, for when nothing was open beneath it. */
function listHref(route: AppRoute, search: URLSearchParams) {
  switch (route.kind) {
    case "issue":
    case "issue-composer":
      return feedHref("issues", route.filter);
    case "facility":
    case "facility-composer":
      return feedHref("facilities", search.get("category"));
    default:
      return feedHref("announcements");
  }
}

function LayerView({ layer, onClosed, open }: { layer: Pinned; onClosed: () => void; open: boolean }) {
  const { t } = useI18n();
  const { route } = layer;
  const list = listHref(route, layer.search);
  // A record keyed by its id starts afresh when the sheet moves to another one.
  const body = <React.Fragment key={"id" in route ? route.id : route.kind}>{layer.element}</React.Fragment>;
  const sheet = (title: string) => (
    <RecordSheet listHref={list} onClosed={onClosed} open={open} size={route.kind.endsWith("composer") ? "lg" : "full"} title={title}>{body}</RecordSheet>
  );
  switch (route.kind) {
    case "issue":
      return <FeatureRouteGuard feature="issues">{sheet(t("ui.nav.issues"))}</FeatureRouteGuard>;
    case "issue-composer":
      return <FeatureRouteGuard feature="issues">{sheet(t("ui.issue.new"))}</FeatureRouteGuard>;
    case "facility":
      return <FeatureRouteGuard feature="facilities">{sheet(t("ui.nav.facilities"))}</FeatureRouteGuard>;
    case "facility-composer":
      return <FeatureRouteGuard feature="facilities">{sheet(t("ui.facility.newTitle"))}</FeatureRouteGuard>;
    case "announcement":
      return sheet(t("ui.nav.announcements"));
    case "announcement-composer":
      return sheet(t("ui.announcement.newTitle"));
    default:
      return null;
  }
}

/**
 * Every signed-in screen, drawn from the address bar. Links inside change the
 * address in place, so moving between screens never waits on the server; a
 * record or composer opens as a sheet over the screen it was opened from,
 * which stays pinned to its own address underneath.
 *
 * The router loads each screen's chunk before the address changes, so the
 * outlet is always ready to show. The host keeps the outlet it was given for
 * each pinned address: the list under a sheet goes on rendering the screen it
 * had, not the record the router has moved on to.
 */
export function AppViews() {
  const location = useBrowserLocation();
  const outlet = useOutlet();
  const route = matchAppRoute(location.pathname);
  const layered = isLayeredRoute(route);
  const [base, setBase] = React.useState<Pinned | null>(null);
  const [layer, setLayer] = React.useState<Pinned | null>(null);
  const scroll = React.useRef(new Map<string, number>());

  if (route.kind !== "redirect" && !layered && base?.key !== location.key) setBase(pin(location, outlet));
  if (layered && !base) setBase(pinHref(listHref(route, location.search), <FeedScreen />));
  if (layered && layer?.key !== location.key) setLayer(pin(location, outlet));

  // An old address keeps its query and fragment on the way to its new home, so a shared
  // `/facilities?category=…` link still opens that category.
  const redirect = route.kind === "redirect" ? withQuery(route.href, location.search) : null;
  React.useEffect(() => {
    if (redirect) navigate(redirect, { replace: true });
  }, [redirect]);

  // Each screen comes back where it was left; a new one starts at the top.
  const basePath = base?.pathname;
  React.useLayoutEffect(() => {
    if (!basePath) return;
    window.scrollTo(0, scroll.current.get(basePath) ?? 0);
    const remember = () => scroll.current.set(basePath, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [basePath]);

  const screen = base?.route.kind === "admin" ? "admin" : basePath;
  return (
    <>
      {base ? (
        <AppLocationProvider value={base}>
          <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }} key={screen} transition={timing("control", "arrive")}>
            <React.Suspense>{base.element}</React.Suspense>
          </motion.div>
        </AppLocationProvider>
      ) : null}
      {layer ? (
        <AppLocationProvider value={layer}>
          <LayerView layer={layer} onClosed={() => { if (!layered) setLayer(null); }} open={layered} />
        </AppLocationProvider>
      ) : null}
    </>
  );
}

function withQuery(href: string, search: URLSearchParams) {
  const url = new URL(href, "http://novae.invalid");
  for (const [key, value] of search) if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${typeof window === "undefined" ? "" : window.location.hash}`;
}
