"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function FeedToolbar({
  disabled = false,
  onQueryChange,
  onSearch,
  onSortChange,
  options,
  query = "",
  searchLabel,
  sort = "latest",
}: {
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
  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label={searchLabel}
          className="pl-9 pr-10 disabled:opacity-100"
          disabled={disabled}
          onChange={(event) => onQueryChange?.(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") onSearch?.(query.trim()); }}
          placeholder={searchLabel}
          value={query}
        />
        {query ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t('ui.common.clearSearch')}
                className="absolute right-1 top-1/2 -translate-y-1/2"
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
      <Select disabled={disabled} onValueChange={onSortChange} value={sort}>
        <SelectTrigger aria-label={t('ui.common.sort')} className="h-10 w-10 shrink-0 justify-center gap-1 px-2 disabled:opacity-100 sm:w-36 sm:justify-between sm:gap-2 sm:px-3">
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
