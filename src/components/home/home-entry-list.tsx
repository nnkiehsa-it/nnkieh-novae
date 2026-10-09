"use client";

import type { LucideIcon } from "lucide-react";
import { ListNavRow, ListSection } from "@/components/ui/list";

export interface HomeEntry { href: string; title: string; icon: LucideIcon; }
export function HomeEntryList({ entries, label }: { entries: HomeEntry[]; label: string }) {
  return <nav aria-label={label}><ListSection>
    {entries.map(({ href, title, icon }) => <ListNavRow key={href} href={href} label={title} icon={icon} />)}
  </ListSection></nav>;
}
