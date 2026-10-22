import { Outlet } from "react-router";
import { AdminShell } from "./admin-shell";

/** The route frame of /admin: the shell, with the section the address names. */
export function AdminLayout() {
  return <AdminShell><Outlet /></AdminShell>;
}
