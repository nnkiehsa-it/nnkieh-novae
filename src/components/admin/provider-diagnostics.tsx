"use client";

import { RefreshCw } from "lucide-react";

import {
  DIAGNOSTIC_PROVIDERS,
  useProviderDiagnostics,
  type DiagnosticProvider,
  type ProviderDiagnostic,
} from "@/hooks/use-provider-diagnostics";
import { useI18n } from "@/i18n";
import {
  CloudinaryReport,
  WorkerLogReport,
  WorkerMetricsReport,
} from "@/components/admin/provider-readings";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/input";
import { ListActionRow, ListCustomRow, ListRow, ListSection } from "@/components/ui/list";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SkeletonRows } from "@/components/ui/skeleton-rows";
import { formatDate } from "@/lib/format";

function Report({ provider, result }: { provider: DiagnosticProvider; result: ProviderDiagnostic }) {
  if (result.status !== "available") return null;
  if (provider === "cloudinary") return <CloudinaryReport data={result.data} />;
  if (provider === "cloudflare") return <WorkerMetricsReport data={result.data} />;
  return <WorkerLogReport data={result.data} />;
}

/**
 * Whether the outside services answer, and what they said.
 *
 * The answer used to be printed as the JSON it arrived in, which meant reading
 * a byte count out of a nested counter and a day of traffic out of four levels
 * of GraphQL envelope. Each provider now says its figures in the same rows the
 * rest of administration uses, and the response it arrived in stays one
 * disclosure away for the cases where the figures are not the question.
 *
 * The two providers that report standing figures answer as the panel opens.
 * The log stream is a search, so it waits for one rather than spending a query
 * on a day of unfiltered events nobody asked for.
 */
export function ProviderDiagnostics() {
  const state = useProviderDiagnostics();
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {state.error ? (
        <ListSection>
          <ListRow label={<span role="alert">{state.error}</span>} tone="destructive" />
        </ListSection>
      ) : null}
      {DIAGNOSTIC_PROVIDERS.map((provider) => {
        const result = state.results[provider];
        const busy = state.busy(provider);
        return (
          <ListSection
            header={t(`ui.operations.provider.${provider}`)}
            headerAction={
              <Button
                aria-label={t("ui.adminConsole.refresh")}
                disabled={busy}
                onClick={() => void state.load(provider)}
                size="icon-sm"
                variant="ghost"
              >
                {busy ? <LoadingSpinner /> : <RefreshCw className="size-4" />}
              </Button>
            }
            key={provider}
          >
            {provider === "logs" ? (
              <ListCustomRow>
                <form
                  className="flex w-full min-w-0 gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void state.load("logs");
                  }}
                >
                  <Input
                    aria-label={t("ui.operations.logSearch")}
                    className="min-w-0 flex-1"
                    maxLength={200}
                    onChange={(event) => state.setQuery(event.target.value)}
                    placeholder={t("ui.operations.logSearch")}
                    value={state.query}
                  />
                  <Button disabled={busy} type="submit" variant="secondary">
                    {busy ? <LoadingSpinner /> : t("ui.common.search")}
                  </Button>
                </form>
              </ListCustomRow>
            ) : null}

            {!result ? (
              busy ? <SkeletonRows rows={2} /> : null
            ) : result.status === "available" ? (
              <ListRow
                label={t("ui.operations.checkedAt")}
                value={formatDate(new Date(result.checkedAt))}
              />
            ) : (
              <ListRow
                label={t(
                  `ui.operations.providerStatus.${
                    result.status === "not-configured" ? "notConfigured" : result.status
                  }`,
                )}
                tone={result.status === "unavailable" ? "destructive" : "default"}
                value={result.error}
              />
            )}

            {result ? <Report provider={provider} result={result} /> : null}

            {result?.data ? (
              <Disclosure label={t("ui.operations.providerDetails")}>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all pb-3 text-xs">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </Disclosure>
            ) : null}

            {result?.nextCursor ? (
              <ListActionRow
                busy={busy}
                label={t("ui.operations.nextPage")}
                onClick={() => void state.load(provider, true)}
              />
            ) : null}
          </ListSection>
        );
      })}
    </div>
  );
}
