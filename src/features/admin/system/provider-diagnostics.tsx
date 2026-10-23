import {
  DIAGNOSTIC_PROVIDERS,
  useProviderDiagnostics,
  type DiagnosticProvider,
  type ProviderDiagnostic,
} from "@/hooks/use-provider-diagnostics";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { ListGroup, ListRow } from "@/ui/list";
import { Skeleton } from "@/ui/feedback";
import { Button } from "@/ui/button";
import { InlineAlert } from "../shared/feedback";
import { RefreshButton } from "../shared/icon-actions";
import { DetailRow } from "../shared/rows";
import { SearchForm } from "../shared/search-form";
import { CloudinaryReport, WorkerLogReport, WorkerMetricsReport } from "./provider-readings";

const STATUS_KEYS = {
  "not-configured": "ui.operations.providerStatus.notConfigured",
  unavailable: "ui.operations.providerStatus.unavailable",
} as const;

function Report({ provider, result }: { provider: DiagnosticProvider; result: ProviderDiagnostic }) {
  if (result.status !== "available") return null;
  if (provider === "cloudinary") return <CloudinaryReport data={result.data} />;
  if (provider === "cloudflare") return <WorkerMetricsReport data={result.data} />;
  return <WorkerLogReport data={result.data} />;
}

/**
 * Whether the outside services answer, and what they said. Each provider
 * states its figures in the rows the rest of administration uses, with the raw
 * response one row away for when the figures are not the question. The
 * providers that report standing figures answer on arrival; the log stream is
 * a search, so it waits for one.
 */
export function ProviderDiagnostics() {
  const state = useProviderDiagnostics();
  const { t } = useI18n();

  return (
    <div className="grid gap-6">
      {state.error ? <InlineAlert>{state.error}</InlineAlert> : null}
      {DIAGNOSTIC_PROVIDERS.map((provider) => {
        const result = state.results[provider];
        const busy = state.busy(provider);
        return (
          <ListGroup
            action={<RefreshButton loading={busy} onClick={() => void state.load(provider)} />}
            key={provider}
            title={t(`ui.operations.provider.${provider}`)}
          >
            {provider === "logs" ? (
              <li className="px-5 py-3">
                <SearchForm
                  label={t("ui.operations.logSearch")}
                  loading={busy}
                  maxLength={200}
                  onQueryChange={state.setQuery}
                  onSearch={() => void state.load("logs")}
                  query={state.query}
                />
              </li>
            ) : null}
            {!result ? (busy ? <li className="px-5 py-4"><Skeleton className="h-6 w-full" /></li> : null) : result.status === "available" ? (
              <ListRow label={t("ui.operations.checkedAt")} value={formatDate(new Date(result.checkedAt))} />
            ) : (
              <ListRow label={t(STATUS_KEYS[result.status])} tone="danger" value={result.status === "unavailable" ? result.error : undefined} />
            )}
            {result ? <Report provider={provider} result={result} /> : null}
            {result?.status === "available" && result.data ? (
              <DetailRow label={t("ui.operations.providerDetails")} title={t("ui.operations.providerDetails")}>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-tile bg-surface-raised p-4 text-xs">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </DetailRow>
            ) : null}
            {result?.status === "available" && result.nextCursor ? (
              <li className="px-5 py-3">
                <Button className="w-full" onClick={() => void state.load(provider, true)} status={busy ? "loading" : "idle"}>
                  {t("ui.operations.nextPage")}
                </Button>
              </li>
            ) : null}
          </ListGroup>
        );
      })}
    </div>
  );
}
