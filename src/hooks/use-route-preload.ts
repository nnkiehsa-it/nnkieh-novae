"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCategories } from "@/hooks/use-categories";
import { useSession } from "@/hooks/use-session";

const PRELOAD_DELAY_MS = 250;

export function useRoutePreload() {
  const router = useRouter();
  const session = useSession();
  const categories = useCategories();
  const canViewDashboard = session.can("dashboard.view");
  const canManageAdministration =
    session.can("role.manage") || session.can("category.manage");
  const facilityCategory = categories.facilityCategories[0]?.id || "";
  const issueCategory =
    categories.issueCategories[0]?.id || "my-proposals";

  React.useEffect(() => {
    if (!categories.loaded || !session.initialized || !session.user) return;

    const routes = [
      ...(categories.issuesEnabled
        ? [
            `/issues/${encodeURIComponent(issueCategory)}`,
            `/issues/${encodeURIComponent(issueCategory)}/new`,
            `/issues/${encodeURIComponent(issueCategory)}/__route-preload__`,
          ]
        : []),
      ...(categories.facilitiesEnabled
        ? [
            "/facilities",
            `/facilities/__route-preload__${facilityCategory ? `?category=${encodeURIComponent(facilityCategory)}` : ""}`,
            ...(facilityCategory
              ? [`/facilities/new?category=${encodeURIComponent(facilityCategory)}`]
              : []),
          ]
        : []),
      "/announcements",
      "/announcements/new",
      "/announcements/__route-preload__",
      "/notifications",
      "/settings",
      ...(canViewDashboard ? ["/dashboard"] : []),
      ...(canManageAdministration
        ? ["/admin/management?tab=categories"]
        : []),
    ];
    let cancelled = false;
    let idleHandle: number | undefined;
    const preload = () => {
      if (cancelled) return;
      routes.forEach((route) => router.prefetch(route));
    };
    const idleWindow = window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(preload, {
        timeout: 1_200,
      });
    } else {
      idleHandle = window.setTimeout(preload, PRELOAD_DELAY_MS);
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
    canManageAdministration,
    canViewDashboard,
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
