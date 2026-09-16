import type { ReactNode } from "react";
import { ProtectedApp } from "@/components/protected-app";

export default function ProtectedLayout({ children, sheet }: { children: ReactNode; sheet: ReactNode }) {
  return <ProtectedApp>{children}{sheet}</ProtectedApp>;
}
