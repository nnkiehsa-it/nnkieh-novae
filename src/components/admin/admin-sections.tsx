"use client";

import {
  FileClock,
  FolderCog,
  ServerCog,
  SlidersHorizontal,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { ListNavRow, ListSection } from "@/components/ui/list";
import {
  ADMIN_GROUPS,
  allowedAdminRoutes,
  type AdminAccess,
} from "@/lib/admin-routes";

const icons: Record<string, LucideIcon> = {
  "/admin/audit": FileClock,
  "/admin/content": FolderCog,
  "/admin/platform": SlidersHorizontal,
  "/admin/people": Users,
  "/admin/policies": Wrench,
  "/admin/system": ServerCog,
};

const groupLabelKeys = {
  content: "admin.groupContent",
  people: "admin.groupPeople",
  system: "admin.groupSystem",
} as const;

/** The access shape the route table wants, read off the session. */
export function adminAccessOf(session: {
  can: (permission: "category.manage" | "dashboard.view" | "role.manage") => boolean;
  isAdmin: boolean;
}): AdminAccess {
  return {
    admin: session.isAdmin,
    categories: session.can("category.manage"),
    members: session.can("role.manage"),
    overview: session.can("dashboard.view"),
  };
}

/** Where administration goes next, grouped so the list can be read at a glance. */
export function AdminSections({ access }: { access: AdminAccess }) {
  useLocaleSubscription();
  const routes = allowedAdminRoutes(access);
  return (
    <div className="space-y-6">
      {ADMIN_GROUPS.map((group) => {
        const inGroup = routes.filter((route) => route.group === group);
        if (inGroup.length === 0) return null;
        return (
          <ListSection header={translate(groupLabelKeys[group])} key={group}>
            {inGroup.map((route) => (
              <ListNavRow
                href={route.href}
                icon={icons[route.href]}
                key={route.href}
                label={translate(route.labelKey)}
              />
            ))}
          </ListSection>
        );
      })}
    </div>
  );
}
