"use client";

import { Search } from "lucide-react";
import type * as React from "react";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorStateContent } from "@/components/ui/page-state";
import { SkeletonRows } from "@/components/ui/skeleton-rows";

export interface DataColumn {
  key: string;
  label: string;
}

/**
 * A searchable, paged list of records.
 *
 * Administration had three of these written out longhand -- users, the audit
 * log, and scope members -- each with its own idea of what an empty result, a
 * failed load and a narrow screen look like. One component means a record list
 * behaves the same wherever it appears, and a new one costs a column list.
 */
export function DataList<T>({
  columns,
  emptyLabel,
  error,
  grid,
  hasMore,
  loading,
  onPageChange,
  onQueryChange,
  onRowSelect,
  onSearch,
  page,
  query,
  renderCell,
  rowKey,
  rows,
  searchPlaceholder,
}: {
  columns: DataColumn[];
  emptyLabel: string;
  error?: string;
  /** The desktop column template; the narrow layout does not use it. */
  grid: string;
  hasMore: boolean;
  loading: boolean;
  onPageChange: (page: number) => void;
  onQueryChange: (query: string) => void;
  onRowSelect?: (row: T) => void;
  /** Loads the list for whatever `query` currently is. */
  onSearch: () => void;
  page: number;
  query?: string;
  renderCell: (row: T, key: string) => React.ReactNode;
  rowKey: (row: T) => string;
  rows: T[];
  searchPlaceholder?: string;
}) {
  useLocaleSubscription();
  const [primary, ...secondary] = columns;
  return (
    <div className="space-y-4">
      {query === undefined ? null : (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={searchPlaceholder}
              value={query}
            />
          </div>
          <Button disabled={loading} type="submit" variant="secondary">
            {loading ? <LoadingSpinner /> : translate("ui.common.search")}
          </Button>
        </form>
      )}

      <div className="rule-card !px-0">
        <div
          className="hidden gap-3 border-b px-[var(--row-gutter)] py-2.5 text-xs font-medium text-muted-foreground lg:grid"
          style={{ gridTemplateColumns: grid }}
        >
          {columns.map((column) => (
            <span key={column.key}>{column.label}</span>
          ))}
        </div>

        {error && rows.length === 0 ? (
          <ErrorStateContent error={error} onRetry={onSearch} />
        ) : loading && rows.length === 0 ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <p className="px-[var(--row-gutter)] py-10 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          <div className="rule-list px-[var(--row-gutter)]">
            {rows.map((row) => (
              <div
                className="t-row flex min-h-[3.25rem] flex-col gap-3 py-[var(--row-padding-block)] lg:grid lg:items-center"
                key={rowKey(row)}
                style={{ gridTemplateColumns: grid }}
              >
                <div className="flex items-start gap-3 lg:contents">
                  {onRowSelect ? (
                    <button
                      className="min-w-0 flex-1 text-left lg:truncate lg:text-sm"
                      onClick={() => onRowSelect(row)}
                      type="button"
                    >
                      {primary ? renderCell(row, primary.key) : null}
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1 lg:truncate lg:text-sm">
                      {primary ? renderCell(row, primary.key) : null}
                    </div>
                  )}
                </div>
                <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:contents">
                  {secondary.map((column) => (
                    <div className="min-w-0 text-xs lg:text-sm" key={column.key}>
                      <span className="block text-muted-foreground lg:hidden">
                        {column.label}
                      </span>
                      <span className="mt-0.5 block lg:mt-0 lg:truncate">
                        {renderCell(row, column.key)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <nav
        aria-label={translate("ui.operations.pagination")}
        className="flex items-center justify-between gap-3"
      >
        <Button
          disabled={loading || page === 0}
          onClick={() => onPageChange(page - 1)}
          variant="secondary"
        >
          {translate("ui.operations.previousPage")}
        </Button>
        <span aria-live="polite" className="text-sm tabular-nums">
          {page + 1}
        </span>
        <Button
          disabled={loading || !hasMore}
          onClick={() => onPageChange(page + 1)}
          variant="secondary"
        >
          {translate("ui.operations.nextPage")}
        </Button>
      </nav>
    </div>
  );
}
