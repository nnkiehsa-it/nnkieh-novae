"use client";

import { useContext, useId } from "react";
import { createPortal } from "react-dom";
import { Icon, Searchbar, f7 } from "framework7-react";
import { useI18n } from "@/i18n";
import { NativeNavbarHost } from "./native-page-context";
import { ToolbarButton } from "./toolbar-button";
import { SortControl } from "./sort-control";
import { useNativeSearchbar } from "./use-native-searchbar";
import { cn } from "@/lib/utils";

export function FeedToolbar({ appliedQuery = "", className, disabled = false, onQueryChange, onSearch, onSortChange, options, query = "", searchLabel, sort = "latest" }: {
  appliedQuery?: string; className?: string; disabled?: boolean;
  onQueryChange?: (value: string) => void; onSearch?: (value: string) => void; onSortChange?: (value: string) => void;
  options: { label: string; value: string }[]; query?: string; searchLabel: string; sort?: string;
}) {
  const { t } = useI18n();
  const host = useContext(NativeNavbarHost);
  const id = useId();
  const search = useNativeSearchbar(searchLabel, {enabled: Boolean(host), disabled, expandable: true});
  return <div className={cn("flex items-center", className)}>
    <ToolbarButton aria-label={searchLabel} disabled={disabled || !host} onClick={() => f7.searchbar.get(search.current.el!).enable()}>
      <Icon f7="search" aria-hidden="true"><span className="sr-only">{appliedQuery}</span></Icon>
    </ToolbarButton>
    <SortControl label={t("ui.common.sort")} disabled={disabled} onChange={(value) => onSortChange?.(value)} options={options} value={sort} iconOnly />
    {host ? createPortal(<Searchbar id={id} ref={search as NonNullable<React.ComponentProps<typeof Searchbar>["ref"]>} expandable customSearch backdrop={false}
      disableButtonText={t("common.cancel")} value={query} placeholder={searchLabel}
      onInput={(event) => onQueryChange?.(event.target.value)}
      onSearchbarClear={() => { onQueryChange?.(""); onSearch?.(""); }}
      onSubmit={(event) => { event.preventDefault(); onSearch?.(query.trim()); }} />, host) : null}
  </div>;
}
