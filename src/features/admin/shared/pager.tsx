"use client";

import { useI18n } from "@/i18n";
import { Button } from "@/ui/button";

/** Previous and next around the number of the page being read. */
export function Pager({ busy, hasMore, onPageChange, page }: {
  busy: boolean;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  page: number;
}) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("ui.operations.pagination")} className="flex items-center justify-between gap-3">
      <Button disabled={busy || page === 0} onClick={() => onPageChange(page - 1)}>
        {t("ui.operations.previousPage")}
      </Button>
      <span aria-live="polite" className="text-sm tabular-nums text-ink-muted">{page + 1}</span>
      <Button disabled={busy || !hasMore} onClick={() => onPageChange(page + 1)}>
        {t("ui.operations.nextPage")}
      </Button>
    </nav>
  );
}
