"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCategories } from "@/hooks/use-categories";
import { useSession } from "@/hooks/use-session";

export function useRoutePreload() {
  const router = useRouter();
  const session = useSession();
  const categories = useCategories();
  const canViewDashboard = session.can("dashboard.view");
  const canManageAdministration =
    session.can("role.manage") || session.can("category.manage");
  const facilityCategory = categories.facilityCategories[0]?.id || "";
  const issueCategory = categories.issueCategories[0]?.id || "my-proposals";

  React.useEffect(() => {
    const primaryRoutes = [
      "/announcements",
      "/notifications",
      "/settings",
    ];
    primaryRoutes.forEach((route) => router.prefetch(route));
  }, [router]);

  React.useEffect(() => {
    if (!session.initialized || !session.user) return;
    if (canViewDashboard) router.prefetch("/dashboard");
    if (canManageAdministration) {
      router.prefetch("/admin/management?tab=categories");
      router.prefetch("/admin/management?tab=members");
    }
  }, [
    canManageAdministration,
    canViewDashboard,
    router,
    session.initialized,
    session.user,
  ]);

  React.useEffect(() => {
    if (!categories.loaded || !session.initialized || !session.user) return;

    const categoryRoutes = [
      ...(categories.issuesEnabled
        ? [`/issues/${encodeURIComponent(issueCategory)}`]
        : []),
      ...(categories.facilitiesEnabled ? ["/facilities"] : []),
    ];
    const deferredRoutes = [
      ...(categories.issuesEnabled
        ? [
            `/issues/${encodeURIComponent(issueCategory)}/new`,
            `/issues/${encodeURIComponent(issueCategory)}/__route-preload__`,
          ]
        : []),
      ...(categories.facilitiesEnabled
        ? [
            `/facilities/__route-preload__${facilityCategory ? `?category=${encodeURIComponent(facilityCategory)}` : ""}`,
            ...(facilityCategory
              ? [`/facilities/new?category=${encodeURIComponent(facilityCategory)}`]
              : []),
          ]
        : []),
      "/announcements/new",
      "/announcements/__route-preload__",
    ];
    let cancelled = false;
    let idleHandle: number | undefined;
    categoryRoutes.forEach((route) => router.prefetch(route));

    const preloadDeferred = () => {
      if (cancelled) return;
      deferredRoutes.forEach((route) => router.prefetch(route));
    };
    const idleWindow = window as unknown as {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(preloadDeferred, {
        timeout: 1_200,
      });
    } else {
      idleHandle = window.setTimeout(preloadDeferred, 250);
    }

    return () => {
      cancelled = true;
      if (idleHandle === undefined) return;
      if (idleWindow.cancelIdleCallback && idleWindow.requestIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
      } else {
        window.clearTimeout(idleHandle);
      }
    };
  }, [
    categories.facilitiesEnabled,
    categories.issuesEnabled,
    categories.loaded,
    facilityCategory,
    issueCategory,
    router,
    session.initialized,
    session.user,
  ]);
}
