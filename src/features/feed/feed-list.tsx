"use client";

import * as React from "react";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { Button } from "@/ui/button";
import { EmptyState, ErrorState } from "@/ui/page";
import { RecordCardSkeleton, recordGridClass } from "./record-card";

/**
 * A feed's records in a grid: placeholders on a cold load, the reason when it
 * failed, an empty state when there is nothing, and "load more" at the end.
 */
export function FeedList<T extends { id: string }>({ empty, error, hasMore = false, items, loading, loadingMore = false, onLoadMore, onRetry, renderItem }: {
  empty: { action?: React.ReactNode; description: React.ReactNode; title: string };
  error?: string;
  hasMore?: boolean;
  items: readonly T[];
  loading: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onRetry: () => void;
  renderItem: (item: T) => React.ReactNode;
}) {
  const { t } = useI18n();
  if (loading && !items.length) {
    return (
      <div aria-busy="true" aria-label={t("common.loading")} className={recordGridClass} role="status">
        {[0, 1, 2, 3].map((slot) => <RecordCardSkeleton key={slot} />)}
      </div>
    );
  }
  if (!items.length) {
    return error
      ? <ErrorState message={error} onRetry={onRetry} retryLabel={t("ui.common.reload")} title={t("ui.common.loadFailed")} />
      : <EmptyState action={empty.action} description={empty.description} title={empty.title} />;
  }
  return (
    <div className="grid gap-3">
      <ul className={recordGridClass}>
        {items.map((item) => <li className="min-w-0" key={item.id}>{renderItem(item)}</li>)}
      </ul>
      {hasMore && onLoadMore ? (
        <Button className="justify-self-center" onClick={onLoadMore} status={loadingMore ? "loading" : "idle"}>
          {loadingMore ? null : <CaretDown weight="bold" />}
          {t(loadingMore ? "ui.common.loadingMore" : "ui.common.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
