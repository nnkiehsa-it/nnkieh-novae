import * as React from "react";
import { createBrowserRouter, Outlet, redirect, useNavigation, useRouteError, type RouteObject } from "react-router";
import { useI18n } from "@/i18n";
import { AppProviders } from "@/features/shell/app-providers";
import { ProtectedApp } from "@/features/shell/protected-app";
import { ErrorState } from "@/ui/page";

/**
 * Every address the app answers, each screen in a chunk of its own that loads
 * the first time it is visited. Administration is a chunk family of its own,
 * so nobody downloads it before opening it.
 *
 * Which screen a path draws, and whether it opens as a sheet over a list, is
 * still decided by `matchAppRoute`; the view host reads these routes' outlet
 * for the component and places it.
 */

const RELOAD_KEY = "novae:chunk-reload";

/**
 * A screen that fails to load is usually one a new deployment has removed:
 * the page reloads into the new build once, then offers a retry.
 */
function RouteError() {
  const error = useRouteError();
  const { t } = useI18n();
  const stale = error instanceof TypeError && /dynamically imported module|Importing a module script failed|error loading dynamically/iu.test(error.message);
  const reloaded = (() => {
    try {
      return sessionStorage.getItem(RELOAD_KEY) === window.location.href;
    } catch {
      return true;
    }
  })();
  React.useEffect(() => {
    if (!stale || reloaded) return;
    try {
      sessionStorage.setItem(RELOAD_KEY, window.location.href);
    } catch {
      return;
    }
    window.location.reload();
  }, [reloaded, stale]);
  if (stale && !reloaded) return null;
  return (
    <main className="content-in mx-auto grid min-h-svh w-full max-w-md items-center px-[var(--gutter)]">
      <ErrorState
        message={t("common.loadFailed")}
        onRetry={() => window.location.reload()}
        retryLabel={t("ui.common.reload")}
        title={t("media.loadFailed")}
      />
    </main>
  );
}

function RootLayout() {
  React.useEffect(() => {
    try {
      sessionStorage.removeItem(RELOAD_KEY);
    } catch {
      // Nothing to forget.
    }
  }, []);
  return (
    <AppProviders>
      <Outlet />
      <RouteProgress />
    </AppProviders>
  );
}

function RouteProgress() {
  const loading = useNavigation().state === "loading";
  return <div aria-hidden className="route-progress" data-active={loading ? "" : undefined} />;
}

const feedScreen = () => import("@/features/feed/feed-page");

/** A record or composer opens over the feed, so the feed loads beside it. */
const layer = <T,>(load: () => Promise<T>, pick: (module: T) => React.ComponentType) => async () => {
  const [module] = await Promise.all([load(), feedScreen()]);
  return { Component: pick(module) };
};

const adminSections: RouteObject[] = [
  { path: "audit", lazy: async () => ({ Component: (await import("@/features/admin/audit/audit-console")).AuditConsole }) },
  { path: "content", lazy: async () => ({ Component: (await import("@/features/admin/content/content-console")).ContentConsole }) },
  { path: "people", lazy: async () => ({ Component: (await import("@/features/admin/people/people-console")).PeopleConsole }) },
  { path: "platform", lazy: async () => ({ Component: (await import("@/features/admin/platform/platform-console")).PlatformConsole }) },
  { path: "policies", lazy: async () => ({ Component: (await import("@/features/admin/policies/policy-console")).PolicyConsole }) },
  { path: "system", lazy: async () => ({ Component: (await import("@/features/admin/system/system-console")).SystemConsole }) },
];

const routes: RouteObject[] = [
  {
    Component: RootLayout,
    ErrorBoundary: RouteError,
    // The first screen's chunk is on its way; the canvas shows meanwhile.
    HydrateFallback: () => null,
    children: [
      { path: "/", loader: () => redirect("/home") },
      { path: "/login", lazy: async () => ({ Component: (await import("@/features/auth/login-page")).LoginPage }) },
      ...(import.meta.env.DEV
        ? [{ path: "/ui-preview", lazy: async () => ({ Component: (await import("./ui-preview/gallery")).Gallery }) }]
        : []),
      {
        Component: ProtectedApp,
        children: [
          { path: "setup", lazy: async () => ({ Component: (await import("@/features/setup/setup-page")).SetupPage }) },
          { path: "home", lazy: async () => ({ Component: (await import("@/features/home/home-page")).HomePage }) },
          { path: "feed", lazy: async () => ({ Component: (await feedScreen()).FeedPage }) },
          { path: "notifications", lazy: async () => ({ Component: (await import("@/features/notifications/notifications-page")).NotificationsPage }) },
          { path: "settings", lazy: async () => ({ Component: (await import("@/features/settings/settings-page")).SettingsPage }) },
          {
            path: "admin",
            lazy: async () => ({ Component: (await import("@/features/admin/shell/admin-layout")).AdminLayout }),
            children: [
              { index: true, lazy: async () => ({ Component: (await import("@/features/admin/overview/admin-overview")).AdminOverview }) },
              ...adminSections,
            ],
          },
          { path: "issues/:filter/compose/new", lazy: layer(() => import("@/features/issues/issue-composer"), (module) => module.IssueComposer) },
          { path: "issues/:filter/:id", lazy: layer(() => import("@/features/issues/issue-detail"), (module) => module.IssueDetail) },
          { path: "facilities/new", lazy: layer(() => import("@/features/facilities/facility-composer"), (module) => module.FacilityComposer) },
          { path: "facilities/:id", lazy: layer(() => import("@/features/facilities/facility-detail"), (module) => module.FacilityDetail) },
          { path: "announcements/new", lazy: layer(() => import("@/features/announcements/announcement-composer"), (module) => module.AnnouncementComposer) },
          { path: "announcements/:id", lazy: layer(() => import("@/features/announcements/announcement-detail"), (module) => module.AnnouncementDetail) },
          // Old and unknown addresses: the view host forwards them.
          { path: "*" },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
