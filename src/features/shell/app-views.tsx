"use client";

import * as React from "react";
import { motion } from "motion/react";
import { useI18n } from "@/i18n";
import { AppLocationProvider, useBrowserLocation, type AppLocation } from "@/hooks/use-app-location";
import { navigate, setViewHostMounted } from "@/lib/app-navigation";
import { feedHref } from "@/lib/feed-href";
import { timing } from "@/lib/motion-timing";
import { isLayeredRoute, matchAppRoute, type AppRoute } from "@/lib/route-hierarchy";
import { AdminOverview } from "@/features/admin/overview/admin-overview";
import { AuditConsole } from "@/features/admin/audit/audit-console";
import { ContentConsole } from "@/features/admin/content/content-console";
import { PeopleConsole } from "@/features/admin/people/people-console";
import { PlatformConsole } from "@/features/admin/platform/platform-console";
import { PolicyConsole } from "@/features/admin/policies/policy-console";
import { AdminShell } from "@/features/admin/shell/admin-shell";
import { SystemConsole } from "@/features/admin/system/system-console";
import { AnnouncementComposer } from "@/features/announcements/announcement-composer";
import { AnnouncementDetail } from "@/features/announcements/announcement-detail";
import { FeatureRouteGuard } from "@/features/content/feature-guard";
import { RecordSheet } from "@/features/content/record-frame";
import { FacilityComposer } from "@/features/facilities/facility-composer";
import { FacilityDetail } from "@/features/facilities/facility-detail";
import { FeedPage } from "@/features/feed/feed-page";
import { HomePage } from "@/features/home/home-page";
import { IssueComposer } from "@/features/issues/issue-composer";
import { IssueDetail } from "@/features/issues/issue-detail";
import { NotificationsPage } from "@/features/notifications/notifications-page";
import { SettingsPage } from "@/features/settings/settings-page";

interface Pinned extends AppLocation {
  key: string;
  route: AppRoute;
}

const ADMIN_SECTIONS: Record<string, React.ComponentType> = {
  audit: AuditConsole,
  content: ContentConsole,
  people: PeopleConsole,
  platform: PlatformConsole,
  policies: PolicyConsole,
  system: SystemConsole,
};

function pin(location: AppLocation & { key: string }): Pinned {
  return { ...location, route: matchAppRoute(location.pathname) };
}

function pinHref(href: string): Pinned {
  const url = new URL(href, "http://novae.invalid");
  return pin({ key: href, pathname: url.pathname, search: url.searchParams });
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

function BaseView({ route }: { route: AppRoute }) {
  if (route.kind === "admin") {
    const Section = route.section ? ADMIN_SECTIONS[route.section] : AdminOverview;
    return <AdminShell>{Section ? <Section /> : null}</AdminShell>;
  }
  if (route.kind !== "view") return null;
  switch (route.view) {
    case "home": return <HomePage />;
    case "feed": return <FeedPage />;
    case "notifications": return <NotificationsPage />;
    case "settings": return <SettingsPage />;
  }
}

function LayerView({ layer, onClosed, open }: { layer: Pinned; onClosed: () => void; open: boolean }) {
  const { t } = useI18n();
  const { route } = layer;
  const list = listHref(route, layer.search);
  const sheet = (title: string, body: React.ReactNode) => (
    <RecordSheet listHref={list} onClosed={onClosed} open={open} size={route.kind.endsWith("composer") ? "lg" : "full"} title={title}>{body}</RecordSheet>
  );
  switch (route.kind) {
    case "issue":
      return <FeatureRouteGuard feature="issues">{sheet(t("ui.nav.issues"), <IssueDetail key={route.id} />)}</FeatureRouteGuard>;
    case "issue-composer":
      return <FeatureRouteGuard feature="issues">{sheet(t("ui.issue.new"), <IssueComposer />)}</FeatureRouteGuard>;
    case "facility":
      return <FeatureRouteGuard feature="facilities">{sheet(t("ui.nav.facilities"), <FacilityDetail key={route.id} />)}</FeatureRouteGuard>;
    case "facility-composer":
      return <FeatureRouteGuard feature="facilities">{sheet(t("ui.facility.newTitle"), <FacilityComposer />)}</FeatureRouteGuard>;
    case "announcement":
      return sheet(t("ui.nav.announcements"), <AnnouncementDetail key={route.id} />);
    case "announcement-composer":
      return sheet(t("ui.announcement.newTitle"), <AnnouncementComposer />);
    default:
      return null;
  }
}

/**
 * Every signed-in screen, drawn from the address bar. Links inside change the
 * address in place, so moving between screens never waits on the server; a
 * record or composer opens as a sheet over the screen it was opened from,
 * which stays pinned to its own address underneath.
 */
export function AppViews() {
  const location = useBrowserLocation();
  const route = matchAppRoute(location.pathname);
  const layered = isLayeredRoute(route);
  const [base, setBase] = React.useState<Pinned | null>(null);
  const [layer, setLayer] = React.useState<Pinned | null>(null);
  const scroll = React.useRef(new Map<string, number>());

  if (route.kind !== "redirect" && !layered && base?.key !== location.key) setBase(pin(location));
  if (layered && !base) setBase(pinHref(listHref(route, location.search)));
  if (layered && layer?.key !== location.key) setLayer(pin(location));

  React.useEffect(() => {
    setViewHostMounted(true);
    return () => setViewHostMounted(false);
  }, []);

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
            <BaseView route={base.route} />
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
