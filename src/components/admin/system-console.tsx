"use client";

import * as React from "react";
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
import { LiquidTabs } from "@/components/ui/liquid-tabs";
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
  const [view, setView] = React.useState("failures");
  const { error, load, loading, page, rebuildNotion, rebuildingNotion, retry, retryAll, retrying, snapshot } =
    useSystemConsole();

  if (error && !snapshot) return <ErrorState error={error} onRetry={() => void load()} />;
  if (!snapshot) return <AdminListSkeleton groups={3} rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LiquidTabs
          ariaLabel={t("admin.systemTitle")}
          onValueChange={setView}
          options={[
            { label: t("admin.systemViewFailures"), value: "failures" },
            { label: t("admin.systemViewCapacity"), value: "capacity" },
            { label: t("admin.systemViewProviders"), value: "providers" },
          ]}
          value={view}
        />
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

      <StateTransition className="min-w-0" data-admin-content identity={view}>
        <ContentTransition identity={view}>
          {view === "failures" ? (
            <div className="space-y-6">
              <NotionRebuildAction
                busy={rebuildingNotion}
                onRebuild={() => void rebuildNotion()}
              />
              <SystemQueue
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
                  disabled={loading || page === 0}
                  onClick={() => void load(page - 1)}
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
                  variant="secondary"
                >
                  {t("ui.operations.nextPage")}
                </Button>
              </nav>
            </div>
          ) : view === "capacity" ? (
            <SystemCapacity snapshot={snapshot} />
          ) : (
            <ProviderDiagnostics />
          )}
        </ContentTransition>
      </StateTransition>
    </div>
  );
}
