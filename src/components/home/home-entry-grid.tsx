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
    <nav aria-label={label} className={cn("grid gap-3 sm:gap-4", entries.length > 1 && "grid-cols-2")}>
      {entries.map(({ href, title, description, icon: Icon }, index) => {
        const wide = entries.length === 1 || (entries.length % 2 === 1 && index === entries.length - 1);
        return (
          <Link
            className={cn(
              "group rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] outline-none transition-[background-color,box-shadow] duration-[var(--motion-control)] hover:bg-[var(--tint-surface)] focus-visible:ring-2 focus-visible:ring-ring sm:p-6",
              wide ? "col-span-full flex items-center gap-4" : "flex flex-col items-start",
            )}
            href={href}
            key={href}
            prefetch={false}
          >
            <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--tint-surface)] text-[var(--tint-content)] sm:size-16">
              <Icon className="size-7" strokeWidth={1.8} />
            </span>
            <span className={cn("min-w-0 flex-1", !wide && "mb-4 mt-4")}>
              <span className="block text-lg font-semibold leading-6 tracking-tight sm:text-xl">{title}</span>
              <span className="mt-2 block text-sm leading-6 text-muted-foreground">{description}</span>
            </span>
            <span aria-hidden="true" className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-[var(--tint-surface)] text-[var(--tint-content)]", !wide && "self-end")}>
              <ArrowRight className="size-5 transition-transform duration-[var(--motion-control)] group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
