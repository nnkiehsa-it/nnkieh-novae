"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HomeEntry {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export function HomeEntryGrid({ entries, label }: { entries: HomeEntry[]; label: string }) {
  return (
    <nav aria-label={label} className={cn("grid gap-3", entries.length > 1 && "grid-cols-2")}>
      {entries.map(({ href, title, description, icon: Icon }, index) => {
        const wide = entries.length === 1 || (entries.length % 2 === 1 && index === entries.length - 1);
        return (
          <Link
            className={cn(
              "group grid gap-3 rounded-xl bg-card p-4 shadow-[var(--shadow-card)] outline-none transition-[background-color,box-shadow] duration-[var(--motion-control)] hover:bg-[var(--tint-surface)] focus-visible:ring-2 focus-visible:ring-ring",
              wide ? "col-span-full grid-cols-[2.25rem_minmax(0,1fr)_1rem] items-center" : "grid-cols-[minmax(0,1fr)_1rem] items-start",
            )}
            href={href}
            key={href}
            prefetch={false}
          >
            <span aria-hidden="true" className="order-1 grid size-9 shrink-0 place-items-center rounded-full bg-[var(--tint-surface)] text-[var(--tint-content)]">
              <Icon className="size-5" strokeWidth={1.8} />
            </span>
            <span className={cn("min-w-0", wide ? "order-2" : "order-3 col-span-full")}>
              <span className="block text-base font-semibold leading-6">{title}</span>
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
            </span>
            <span aria-hidden="true" className={cn("self-center text-[var(--tint-content)]", wide ? "order-3" : "order-2")}>
              <ArrowRight className="size-4 transition-transform duration-[var(--motion-control)] group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
