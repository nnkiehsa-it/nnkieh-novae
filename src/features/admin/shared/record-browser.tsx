import type * as React from "react";
import { useI18n } from "@/i18n";
import { Button } from "@/ui/button";
import { ListGroup } from "@/ui/list";
import { EmptyState, ErrorState, LoadingList } from "@/ui/page";
import { InlineAlert } from "./feedback";
import { Pager } from "./pager";
import { SearchForm } from "./search-form";

/**
 * A searched, paged list of records. It owns the search field, what a first
 * read, an empty result and a failed read look like, and the paging; what one
 * record looks like is the caller's, passed in as list rows.
 */
export function RecordBrowser({ children, count, disabled = false, emptyLabel, error, hasMore, loading, onPageChange, onQueryChange, onReset, onSearch, page, query, searchLabel }: {
  children: React.ReactNode;
  /** How many records `children` draws; it decides which state is shown. */
  count: number;
  disabled?: boolean;
  emptyLabel: string;
  error?: string;
  hasMore: boolean;
  loading: boolean;
  onPageChange: (page: number) => void;
  onQueryChange: (query: string) => void;
  onReset: () => void;
  /** Loads the list for whatever `query` currently is. */
  onSearch: () => void;
  page: number;
  query: string;
  searchLabel: string;
}) {
  const { t } = useI18n();
  const busy = loading || disabled;
  return (
    <div className="grid gap-4">
      <SearchForm
        disabled={disabled}
        label={searchLabel}
        loading={loading}
        onQueryChange={onQueryChange}
        onReset={onReset}
        onSearch={onSearch}
        query={query}
      />
      {error && count > 0 ? (
        <div className="flex items-center gap-3 px-1">
          <div className="min-w-0 flex-1"><InlineAlert>{error}</InlineAlert></div>
          <Button disabled={busy} onClick={onSearch} size="sm">{t("common.retry")}</Button>
        </div>
      ) : null}
      {error && count === 0 ? (
        <ErrorState message={error} onRetry={onSearch} retryLabel={t("common.retry")} title={t("ui.common.loadFailed")} />
      ) : loading && count === 0 ? (
        <LoadingList label={t("common.loading")} rows={4} />
      ) : count === 0 ? (
        <EmptyState title={emptyLabel} />
      ) : (
        <ListGroup label={searchLabel}>{children}</ListGroup>
      )}
      <Pager busy={busy} hasMore={hasMore} onPageChange={onPageChange} page={page} />
    </div>
  );
}
