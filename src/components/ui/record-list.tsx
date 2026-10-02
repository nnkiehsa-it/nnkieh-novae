"use client";

import { Search, X } from "lucide-react";
import type * as React from "react";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorStateContent } from "@/components/ui/page-state";
import { SkeletonRows } from "@/components/ui/skeleton-rows";

/**
 * The frame a searched, paged administrative record list wears.
 *
 * It owns the one search field, the card the records sit in, what an empty
 * result, a failed load and a first read look like, and the paging underneath.
 * What a record looks like is the caller's business. People and recorded
 * actions used to be forced through one column table because they shared this
 * chrome, which cost both of them a stack of labelled fields on every screen
 * narrower than a desktop.
 */
export function RecordList({
  children,
  count,
  disabled = false,
  emptyLabel,
  error,
  hasMore,
  loading,
  onPageChange,
  onQueryChange,
  onSearch,
  onReset,
  page,
  query,
  searchPlaceholder,
}: {
  children: React.ReactNode;
  /** How many records `children` draws; it decides which state the card shows. */
  count: number;
  disabled?: boolean;
  emptyLabel: string;
  error?: string;
  hasMore: boolean;
  loading: boolean;
  onPageChange: (page: number) => void;
  onQueryChange: (query: string) => void;
  /** Loads the list for whatever `query` currently is. */
  onSearch: () => void;
  onReset?: () => void;
  page: number;
  query: string;
  searchPlaceholder: string;
}) {
  useLocaleSubscription();
  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && !loading) onSearch();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={searchPlaceholder}
            className="pl-9 pr-10"
            disabled={disabled}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            value={query}
          />
          {query && onReset ? (
            <Button aria-label={translate("admin.resetSearch")} className="absolute right-1 top-1/2 -translate-y-1/2"
              disabled={loading || disabled} onClick={onReset} size="icon-sm" type="button" variant="ghost">
              <X aria-hidden className="size-4" />
            </Button>
          ) : null}
        </div>
        <Button disabled={loading || disabled} type="submit" variant="secondary">
          {loading ? <LoadingSpinner /> : translate("ui.common.search")}
        </Button>
      </form>

      {error && count > 0 ? (
        <div className="flex items-center gap-3" role="alert">
          <p className="min-w-0 flex-1 text-sm text-destructive">{error}</p>
          <Button disabled={loading || disabled} onClick={onSearch} size="sm" variant="secondary">{translate("common.retry")}</Button>
        </div>
      ) : null}

      <div className="rule-card !px-0">
        {error && count === 0 ? (
          <ErrorStateContent error={error} onRetry={onSearch} />
        ) : loading && count === 0 ? (
          <SkeletonRows />
        ) : count === 0 ? (
          <p className="px-[var(--row-gutter)] py-10 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          children
        )}
      </div>

      <nav
        aria-label={translate("ui.operations.pagination")}
        className="flex items-center justify-between gap-3"
      >
        <Button
          disabled={loading || disabled || page === 0}
          onClick={() => onPageChange(page - 1)}
          variant="secondary"
        >
          {translate("ui.operations.previousPage")}
        </Button>
        <span aria-live="polite" className="text-sm tabular-nums">
          {page + 1}
        </span>
        <Button
          disabled={loading || disabled || !hasMore}
          onClick={() => onPageChange(page + 1)}
          variant="secondary"
        >
          {translate("ui.operations.nextPage")}
        </Button>
      </nav>
    </div>
  );
}
