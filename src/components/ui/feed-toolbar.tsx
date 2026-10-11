"use client";

import { useContext, useId } from "react";
import { createPortal } from "react-dom";
import { Icon, Link, Searchbar, f7 } from "framework7-react";
import { useI18n } from "@/i18n";
import { NativeNavbarHost } from "./native-page-context";
import { SortControl } from "./sort-control";
import { useNativeSearchbar } from "./use-native-searchbar";
import { useFramework7Control } from "./use-framework7-control";
import { cn } from "@/lib/utils";

function SearchButton({disabled, label, onOpen, query}: {disabled: boolean; label: string; onOpen: () => void; query: string}) {
  const ref = useFramework7Control<HTMLAnchorElement>(undefined, undefined, {role: "button", tabindex: disabled ? -1 : 0});
  return <Link ref={ref as NonNullable<React.ComponentProps<typeof Link>["ref"]>} iconOnly disabled={disabled} aria-label={label} onClick={onOpen}>
    <Icon f7="search" aria-hidden="true"><span className="sr-only">{query}</span></Icon>
  </Link>;
}

export function FeedToolbar({ appliedQuery = "", className, disabled = false, onQueryChange, onSearch, onSortChange, options, query = "", searchLabel, sort = "latest" }: {
  appliedQuery?: string; className?: string; disabled?: boolean;
  onQueryChange?: (value: string) => void; onSearch?: (value: string) => void; onSortChange?: (value: string) => void;
  options: { label: string; value: string }[]; query?: string; searchLabel: string; sort?: string;
}) {
  const { t } = useI18n();
  const host = useContext(NativeNavbarHost);
  const id = useId().replaceAll(":", "");
  const search = useNativeSearchbar(searchLabel, {enabled: Boolean(host), disabled, expandable: true});
  const clear = () => {onQueryChange?.(""); onSearch?.("");};
  return <div className={cn("flex items-center", className)}>
    <SearchButton disabled={disabled || !host} label={searchLabel} query={appliedQuery} onOpen={() => {
      const native = f7.searchbar.get(search.current.el!);
      native.enable();
      native.search(query);
    }} />
    <SortControl label={t("ui.common.sort")} disabled={disabled} onChange={(value) => onSortChange?.(value)} options={options} value={sort} iconOnly />
    {host ? createPortal(<Searchbar id={id} ref={search as NonNullable<React.ComponentProps<typeof Searchbar>["ref"]>} expandable customSearch backdrop={false}
      disableButtonText={t("common.cancel")} value={query} placeholder={searchLabel}
      onInput={(event) => onQueryChange?.(event.target.value)}
      onSearchbarClear={clear}
      onSubmit={(event) => { event.preventDefault(); onSearch?.(query.trim()); }} />, host) : null}
  </div>;
}
