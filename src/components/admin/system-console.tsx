"use client";

import { useAdminView } from "@/hooks/use-admin-view";
import { RefreshCw } from "lucide-react";

import { useI18n } from "@/i18n";
import { useSystemConsole } from "@/hooks/use-system-console";
import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton";
import { ProviderDiagnostics } from "@/components/admin/provider-diagnostics";
import { SystemCapacity } from "@/components/admin/system-capacity";
import { SystemQueue } from "@/components/admin/system-queue";
import { NotionRebuildAction } from "@/components/admin/notion-rebuild-action";
import { ContentTransition, StateTransition } from "@/components/motion/state-transition";
import { Button } from "@/components/ui/button";
import { AdminAreaNavigation } from "@/components/admin/admin-area-navigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/page-state";

/**
 * How the platform is running, read one question at a time.
 *
 * What failed, how much room is left and whether the outside services answer
 * are three separate questions that used to be stacked on one another, with the
 * page controls for the first of them floating above all three. Each is a view
 * now, and the paging belongs to the only view it ever moved.
 */
export function SystemConsole() {
  const { t } = useI18n();
  const [view, setView] = useAdminView(["overview", "failures", "capacity", "providers"] as const);
  return <div className="space-y-6">
    <AdminAreaNavigation value={view} onSelect={setView} areas={[
      { value: "failures", label: t("admin.systemViewFailures"), detail: t("admin.summary.failures") },
      { value: "capacity", label: t("admin.systemViewCapacity"), detail: t("admin.summary.capacity") },
      { value: "providers", label: t("admin.systemViewProviders"), detail: t("admin.summary.providers") },
    ]} />
    {view === "providers" ? <ProviderDiagnostics /> : view !== "overview" ? <SystemReading view={view} /> : null}
  </div>;
}

function SystemReading({ view }: { view: "failures" | "capacity" }) {
  const { t } = useI18n();
  const {
    busy, clearErrors, clearSchedules, clearing, error, load, loading, notionJob, page, rebuildNotion,
    rebuildingNotion, retry, retryAll, retrying, snapshot,
  } = useSystemConsole();

  if (error && !snapshot) return <ErrorState error={error} onRetry={() => void load()} />;
  if (!snapshot) return <AdminListSkeleton groups={3} rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          aria-label={t("ui.adminConsole.refresh")}
          disabled={loading || busy}
          onClick={() => void load(page)}
          size="icon-sm"
          variant="ghost"
        >
          {loading ? <LoadingSpinner /> : <RefreshCw className="size-4" />}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

      <StateTransition className="min-w-0" data-admin-content identity={view}>
        <ContentTransition identity={view}>
          {view === "failures" ? (
            <div className="space-y-6">
              <NotionRebuildAction
                busy={rebuildingNotion}
                disabled={busy || loading}
                job={notionJob}
                onRebuild={() => void rebuildNotion()}
              />
              <SystemQueue
                busy={busy || loading}
                clearing={clearing}
                onClearErrors={() => void clearErrors()}
                onClearSchedules={() => void clearSchedules()}
                onRetry={retry}
                onRetryAll={() => void retryAll()}
                retrying={retrying}
                snapshot={snapshot}
              />
              <nav
                aria-label={t("ui.operations.pagination")}
                className="flex items-center justify-between gap-3"
              >
                <Button
                  disabled={loading || busy || page === 0}
                  onClick={() => void load(page - 1)}
                  variant="secondary"
                >
                  {t("ui.operations.previousPage")}
                </Button>
                <span aria-live="polite" className="text-sm tabular-nums">
                  {page + 1}
                </span>
                <Button
                  disabled={loading || busy || !snapshot.hasMore}
                  onClick={() => void load(page + 1)}
                  variant="secondary"
                >
                  {t("ui.operations.nextPage")}
                </Button>
              </nav>
            </div>
          ) : (
            <SystemCapacity snapshot={snapshot} />
          )}
        </ContentTransition>
      </StateTransition>
    </div>
  );
}
