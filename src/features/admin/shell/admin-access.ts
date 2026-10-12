"use client";

import { useSession } from "@/hooks/use-session";
import type { AdminAccess } from "@/lib/admin-routes";

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

export function useAdminAccess(): AdminAccess {
  return adminAccessOf(useSession());
}
