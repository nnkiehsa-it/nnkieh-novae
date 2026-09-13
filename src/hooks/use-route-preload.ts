"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCategories } from "@/hooks/use-categories";
import { useSession } from "@/hooks/use-session";
import { allowedAdminRoutes, canEnterAdministration } from "@/lib/admin-routes";

export function useRoutePreload() {
  const router = useRouter();
  const session = useSession();
  const categories = useCategories();
  const isAdmin = session.isAdmin;
  const canManageCategories = session.can("category.manage");
  const canManageRoles = session.can("role.manage");
  const canViewDashboard = session.can("dashboard.view");
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
    const access = {
      admin: isAdmin,
      categories: canManageCategories,
      members: canManageRoles,
      overview: canViewDashboard,
    };
    if (!canEnterAdministration(access)) return;
    router.prefetch("/admin");
    allowedAdminRoutes(access).forEach((route) => router.prefetch(route.href));
  }, [
    canManageCategories,
    canManageRoles,
    canViewDashboard,
    isAdmin,
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
    const secondaryRoutes = [
      ...(categories.issuesEnabled
        ? [
            ...categories.issueCategories.map(
              (cat) => `/issues/${encodeURIComponent(cat.id)}`,
            ),
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
    categoryRoutes.forEach((route) => router.prefetch(route));
    secondaryRoutes.forEach((route) => router.prefetch(route));
  }, [
    categories.facilitiesEnabled,
    categories.issueCategories,
    categories.issuesEnabled,
    categories.loaded,
    facilityCategory,
    issueCategory,
    router,
    session.initialized,
    session.user,
  ]);
}
