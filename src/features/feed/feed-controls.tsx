"use client";

import * as React from "react";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { pinnedHeaderClass } from "@/ui/page";
import { Button } from "@/ui/button";
import { Input } from "@/ui/field";
import { Popover } from "@/ui/popover";
import { Select, type SelectOption } from "@/ui/select";

/**
 * Search behind a button: the field is full width when it is being used and
 * out of the way otherwise; a dot on the button says a query is applied.
 */
export function SearchControl({ applied, label, onQueryChange, onSearch, query }: {
  applied: string;
  label: string;
  onQueryChange: (value: string) => void;
  onSearch: (value: string) => void;
  query: string;
}) {
  const { t } = useI18n();
  return (
    <Popover
      trigger={
        <Button aria-label={label} className="relative" size="icon">
          <MagnifyingGlass />
          {applied ? <span aria-hidden className="absolute right-2.5 top-2.5 size-2 rounded-full bg-contrast" /> : null}
        </Button>
      }
    >
      <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); onSearch(query.trim()); }}>
        <Input aria-label={label} autoFocus className="h-11" onChange={(event) => onQueryChange(event.target.value)} placeholder={label} value={query} />
        <div className="flex justify-end gap-2">
          <Button disabled={!query && !applied} onClick={() => { onQueryChange(""); onSearch(""); }} size="sm" variant="ghost">{t("ui.common.clearSearch")}</Button>
          <Button size="sm" type="submit" variant="primary">{t("ui.common.search")}</Button>
        </div>
      </form>
    </Popover>
  );
}

/**
 * The pinned top of a feed: a round button on each side of the view switch,
 * like an app's top bar. Either side may be empty; the switch stays centred.
 */
export function FeedTopBar({ center, left, right }: { center: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className={cn(pinnedHeaderClass, "grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2")}>
      <div className="flex justify-start">{left}</div>
      <div className="flex min-w-0 justify-center">{center}</div>
      <div className="flex justify-end">{right}</div>
    </header>
  );
}

/** Categories as a sideways-scrolling row of chips; the chosen one is filled. */
export function CategoryChips<Value extends string>({ label, onChange, options, value }: {
  label: string;
  onChange: (value: Value) => void;
  options: readonly SelectOption<Value>[];
  value: Value;
}) {
  return (
    <div aria-label={label} className="-mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none]" role="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            aria-checked={selected}
            className={cn(
              "h-9 shrink-0 rounded-full px-4 text-sm font-medium outline-none transition-[background-color,color] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              selected ? "bg-contrast text-on-contrast" : "bg-surface text-ink-muted shadow-panel hover:text-ink",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The quiet line above a feed: which half of it is shown (open or closed),
 * as two words to tap, and the order at the other end.
 */
export function FeedFilterLine<Bucket extends string, Sort extends string>({ bucket, buckets, bucketLabel, onBucketChange, onSortChange, sort, sorts }: {
  bucket: Bucket;
  bucketLabel: string;
  buckets: readonly SelectOption<Bucket>[];
  onBucketChange: (value: Bucket) => void;
  onSortChange: (value: Sort) => void;
  sort: Sort;
  sorts: readonly SelectOption<Sort>[];
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-sm">
      <div aria-label={bucketLabel} className="flex items-center gap-1" role="radiogroup">
        {buckets.map((option, index) => (
          <React.Fragment key={option.value}>
            {index > 0 ? <span aria-hidden className="text-ink-faint">·</span> : null}
            <button
              aria-checked={option.value === bucket}
              className={cn(
                "rounded-chip px-1.5 py-1 outline-none transition-[color] duration-[var(--motion-control)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                option.value === bucket ? "font-semibold text-ink" : "text-ink-faint hover:text-ink-muted",
              )}
              onClick={() => onBucketChange(option.value)}
              role="radio"
              type="button"
            >
              {option.label}
            </button>
          </React.Fragment>
        ))}
      </div>
      <Select
        className="inline-flex items-center gap-1 rounded-chip px-1.5 py-1 text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        label={t("ui.common.sort")}
        onChange={onSortChange}
        options={sorts}
        renderTrigger={(selected) => <><span>{selected?.label}</span><CaretDown aria-hidden className="size-3.5" weight="bold" /></>}
        value={sort}
      />
    </div>
  );
}

