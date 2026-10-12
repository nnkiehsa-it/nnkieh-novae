"use client";

import { useAdminView } from "@/hooks/use-admin-view";
import { useSystemConsole } from "@/hooks/use-system-console";
import { useI18n } from "@/i18n";
import { LoadingList } from "@/ui/page";
import { InlineAlert, LoadError } from "../shared/feedback";
import { RefreshButton } from "../shared/icon-actions";
import { Pager } from "../shared/pager";
import { SectionTabs } from "../shared/section-tabs";
import { NotionRebuildAction } from "./notion-rebuild-action";
import { ProviderDiagnostics } from "./provider-diagnostics";
import { SystemCapacity } from "./system-capacity";
import { SystemQueue } from "./system-queue";

const VIEWS = ["failures", "capacity", "providers"] as const;

/**
 * How the platform is running, read one question at a time: what failed, how
 * much room is left, and whether the outside services answer. Paging belongs
 * to the failures, the only view it ever moves.
 */
export function SystemConsole() {
  const { t } = useI18n();
  const [view, setView] = useAdminView(VIEWS);
  return (
    <div className="grid gap-6">
      <SectionTabs
        label={t("admin.systemTitle")}
        onChange={setView}
        sections={[
          { detail: t("admin.summary.failures"), label: t("admin.systemViewFailures"), value: "failures" },
          { detail: t("admin.summary.capacity"), label: t("admin.systemViewCapacity"), value: "capacity" },
          { detail: t("admin.summary.providers"), label: t("admin.systemViewProviders"), value: "providers" },
        ]}
        value={view}
      />
      {view === "providers" ? <ProviderDiagnostics /> : <SystemReading view={view} />}
    </div>
  );
}

function SystemReading({ view }: { view: "capacity" | "failures" }) {
  const { t } = useI18n();
  const system = useSystemConsole();
  const { busy, error, load, loading, page, snapshot } = system;

  if (error && !snapshot) return <LoadError message={error} onRetry={() => void load()} />;
  if (!snapshot) return <LoadingList label={t("common.loading")} rows={4} />;

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <RefreshButton disabled={busy} loading={loading} onClick={() => void load(page)} />
      </div>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      {view === "failures" ? (
        <>
          <NotionRebuildAction
            busy={system.rebuildingNotion}
            disabled={busy || loading}
            job={system.notionJob}
            onRebuild={() => void system.rebuildNotion()}
          />
          <SystemQueue
            busy={busy || loading}
            clearing={system.clearing}
            onClearErrors={() => void system.clearErrors()}
            onClearSchedules={() => void system.clearSchedules()}
            onRetry={system.retry}
            onRetryAll={() => void system.retryAll()}
            retrying={system.retrying}
            snapshot={snapshot}
          />
          <Pager busy={loading || busy} hasMore={Boolean(snapshot.hasMore)} onPageChange={(next) => void load(next)} page={page} />
        </>
      ) : (
        <SystemCapacity snapshot={snapshot} />
      )}
    </div>
  );
}
