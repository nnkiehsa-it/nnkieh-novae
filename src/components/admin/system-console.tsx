"use client";

import { RefreshCw } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSystemConsole } from "@/hooks/use-system-console";
import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton";
import { ProviderDiagnostics } from "@/components/admin/provider-diagnostics";
import { SystemCapacity } from "@/components/admin/system-capacity";
import { SystemQueue } from "@/components/admin/system-queue";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/page-state";

/** Everything about how the platform is running, on one screen. */
export function SystemConsole() {
  const { t } = useI18n();
  const { error, load, loading, mediaFailures, page, retry, retrying, snapshot } =
    useSystemConsole();

  if (error && !snapshot) return <ErrorState error={error} onRetry={() => void load()} />;
  if (!snapshot) return <AdminListSkeleton groups={3} rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button
          disabled={loading || page === 0}
          onClick={() => void load(page - 1)}
          size="sm"
          variant="secondary"
        >
          {t("ui.operations.previousPage")}
        </Button>
        <span aria-live="polite" className="text-sm tabular-nums">
          {page + 1}
        </span>
        <Button
          disabled={loading || !snapshot.hasMore}
          onClick={() => void load(page + 1)}
          size="sm"
          variant="secondary"
        >
          {t("ui.operations.nextPage")}
        </Button>
        <Button
          aria-label={t("ui.adminConsole.refresh")}
          disabled={loading}
          onClick={() => void load(page)}
          size="icon-sm"
          variant="ghost"
        >
          {loading ? <LoadingSpinner /> : <RefreshCw className="size-4" />}
        </Button>
      </div>

      <SystemQueue
        mediaFailures={mediaFailures}
        onRetry={retry}
        retrying={retrying}
        snapshot={snapshot}
      />
      <SystemCapacity snapshot={snapshot} />
      <ProviderDiagnostics />
    </div>
  );
}
