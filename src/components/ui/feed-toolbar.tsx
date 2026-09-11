"use client";

import * as React from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * One search/sort control pair for every feed, at every width.
 *
 * The field lives in a popover rather than the row: a feed's header already
 * carries a category title, a create action, and status tabs, and a permanently
 * open text input either crowds them or claims a line of its own that stays
 * empty most of the time. Behind its own control the field is full width when it
 * is actually being used, and a dot on the trigger says a query is still applied
 * once the popover closes.
 */
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
  const [open, setOpen] = React.useState(false);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover onOpenChange={setOpen} open={open}>
        <Tooltip>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                aria-label={searchLabel}
                className="relative"
                disabled={disabled}
                size="icon"
                type="button"
              >
                <Search />
                {query ? (
                  <span
                    aria-hidden
                    className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--tint-content)]"
                  />
                ) : null}
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent>{searchLabel}</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              onSearch?.(query.trim());
              setOpen(false);
            }}
          >
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label={searchLabel}
                autoFocus
                className="pl-9"
                onChange={(event) => onQueryChange?.(event.target.value)}
                placeholder={searchLabel}
                value={query}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                disabled={!query}
                onClick={() => { onQueryChange?.(""); onSearch?.(""); setOpen(false); }}
                size="sm"
                type="button"
                variant="ghost"
              >{t('ui.common.clearSearch')}</Button>
              <Button size="sm" type="submit">{t('ui.common.search')}</Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
      <Select disabled={disabled} onValueChange={onSortChange} value={sort}>
        <SelectTrigger aria-label={t('ui.common.sort')} className="size-9 shrink-0 justify-center gap-0 px-0 [&_.t-disclosure-icon]:hidden disabled:opacity-100 sm:w-36 sm:justify-between sm:gap-2 sm:px-3 sm:[&_.t-disclosure-icon]:block">
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
