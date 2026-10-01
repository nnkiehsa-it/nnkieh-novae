"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { ListSection, rowClass } from "@/components/ui/list";
import { cn } from "@/lib/utils";

export interface HomeEntry {
  href: string;
  title: string;
  icon: LucideIcon;
}

export function HomeEntryList({ entries, label }: { entries: HomeEntry[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ListSection>
        {entries.map(({ href, title, icon: Icon }) => (
          <Link
            className={cn(rowClass, "group gap-3 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring")}
            href={href}
            key={href}
            prefetch={false}
          >
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--tint-surface)] text-[var(--tint-content)]">
              <Icon className="size-5" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1 text-base font-semibold leading-6">{title}</span>
            <ArrowRight aria-hidden className="size-4 shrink-0 text-[var(--tint-content)] transition-transform duration-[var(--motion-control)] group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        ))}
      </ListSection>
    </nav>
  );
}
