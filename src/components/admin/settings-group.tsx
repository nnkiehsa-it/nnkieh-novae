"use client";

import type { ReactNode } from "react";
import { NativeAccordionItem } from "@/components/ui/native-accordion-item";
import { ListSection } from "@/components/ui/list";

export function SettingsGroup({ children, defaultOpen = false, title }: { children: ReactNode; defaultOpen?: boolean; title: string }) {
  return <ListSection><NativeAccordionItem defaultOpen={defaultOpen} label={title}>
    <div className="p-4">{children}</div>
  </NativeAccordionItem></ListSection>;
}
