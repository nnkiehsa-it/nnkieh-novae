"use client";

import * as React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function FeedToolbar({
  className,
  disabled = false,
  onQueryChange,
  onSearch,
  onSortChange,
  options,
  query = "",
  searchLabel,
  sort = "latest",
}: {
  className?: string;
  disabled?: boolean;
  onQueryChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onSortChange?: (value: string) => void;
  options: { label: string; value: string }[];
  query?: string;
  searchLabel: string;
  sort?: string;
}) {
  const { t } = useI18n();
  // On a mobile layout the field would eat the control row, so it waits behind an icon
  // and takes the row for itself once it is asked for.
  const [searching, setSearching] = React.useState(false);
  const field = React.useRef<HTMLInputElement>(null);
  return (
    <div className={cn("flex items-center gap-2", searching && "w-full", className)}>
      <div className={cn("relative min-w-0 flex-1", !searching && "hidden sm:block")}>
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label={searchLabel}
          className="pl-9 pr-10 disabled:opacity-100"
          disabled={disabled}
          onChange={(event) => onQueryChange?.(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") onSearch?.(query.trim()); }}
          placeholder={searchLabel}
          ref={field}
          value={query}
        />
        {query ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t('ui.common.clearSearch')}
                className="absolute right-1 top-1/2 hidden -translate-y-1/2 sm:inline-flex"
                onClick={() => { onQueryChange?.(""); onSearch?.(""); }}
                size="icon-sm"
                type="button"
                variant="ghost"
              ><X /></Button>
            </TooltipTrigger>
            <TooltipContent>{t('ui.common.clearSearch')}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {searching ? (
        <Button
          aria-label={t('ui.common.clearSearch')}
          className="sm:hidden"
          disabled={disabled}
          onClick={() => { setSearching(false); onQueryChange?.(""); onSearch?.(""); }}
          size="icon"
          type="button"
          variant="ghost"
        ><X /></Button>
      ) : (
        <Button
          aria-label={searchLabel}
          className="sm:hidden"
          disabled={disabled}
          onClick={() => { setSearching(true); window.requestAnimationFrame(() => field.current?.focus()); }}
          size="icon"
          type="button"
        ><Search /></Button>
      )}
      <Select disabled={disabled} onValueChange={onSortChange} value={sort}>
        <SelectTrigger aria-label={t('ui.common.sort')} className="size-9 shrink-0 justify-center gap-0 px-0 sm:h-10 [&_.t-disclosure-icon]:hidden disabled:opacity-100 sm:w-36 sm:justify-between sm:gap-2 sm:px-3 sm:[&_.t-disclosure-icon]:block">
          <SlidersHorizontal className="shrink-0 sm:hidden" />
          <span className="hidden sm:inline"><SelectValue /></span>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
