"use client";

import type * as React from "react";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorStateContent } from "@/components/ui/page-state";
import { SkeletonRows } from "@/components/ui/skeleton-rows";
import { ListSection, ListCustomRow } from "@/components/ui/list";

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
        <SearchField label={searchPlaceholder} disabled={disabled} className="min-w-0 flex-1"
          onChange={onQueryChange} onClear={onReset} value={query} />
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

      <ListSection>
        {error && count === 0 ? (
          <ListCustomRow><ErrorStateContent error={error} onRetry={onSearch} /></ListCustomRow>
        ) : loading && count === 0 ? (
          <ListCustomRow><SkeletonRows /></ListCustomRow>
        ) : count === 0 ? (
          <ListCustomRow><p className="py-10 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p></ListCustomRow>
        ) : (
          children
        )}
      </ListSection>

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
