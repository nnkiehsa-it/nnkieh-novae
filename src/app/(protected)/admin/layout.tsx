import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin/shell/admin-shell";

export default function AdministrationLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
