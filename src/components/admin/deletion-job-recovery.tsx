"use client";

import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useDeletionJobs } from "@/hooks/use-deletion-jobs";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";

export function DeletionJobRecovery() {
  const { t } = useI18n();
  const { entries, error, load, loading, retry, retryingId } = useDeletionJobs();

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{t("ui.adminConsole.mediaDeletionFailures")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("ui.adminConsole.mediaDeletionFailuresHelp")}
          </p>
        </div>
        <Button
          aria-label={t("ui.adminConsole.refresh")}
          disabled={loading}
          onClick={() => void load()}
          size="icon-sm"
          variant="ghost"
        >
          {loading ? <LoadingSpinner /> : <RefreshCw className="size-4" />}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {error ? (
          <div className="flex items-start gap-2 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : entries.length === 0 ? (
          <p className="px-4 py-5 text-center text-sm text-muted-foreground">
            {loading
              ? t("ui.adminConsole.loadingDeletionJobs")
              : t("ui.adminConsole.noMediaDeletionFailures")}
          </p>
        ) : entries.map((entry) => (
          <div className="space-y-2 border-b px-4 py-3 last:border-b-0" key={entry.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{entry.targetType}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{entry.targetId}</p>
              </div>
              <Button
                disabled={Boolean(retryingId)}
                onClick={() => void retry(entry.id)}
                size="sm"
                variant="outline"
              >
                {retryingId === entry.id
                  ? <LoadingSpinner />
                  : <RotateCcw className="size-3.5" />}
                {t("ui.adminConsole.retryDeletion")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("ui.adminConsole.deletionFailureMeta", {
                attempts: entry.attemptCount,
                updatedAt: formatDate(entry.updatedAt),
              })}
            </p>
            {entry.errorTraceId ? (
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {t("ui.adminConsole.errorTrace", { traceId: entry.errorTraceId })}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
