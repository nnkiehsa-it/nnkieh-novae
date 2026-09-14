"use client";

import { useProviderDiagnostics } from "@/hooks/use-provider-diagnostics";
import { useI18n } from "@/i18n";
import { Disclosure } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/input";
import { ListActionRow, ListCustomRow, ListRow, ListSection } from "@/components/ui/list";

const PROVIDERS = ["cloudinary", "cloudflare", "logs"] as const;

/**
 * Whether the outside services answer, asked one at a time.
 *
 * Each provider is a group: the control that asks it, what it said, and — only
 * if it sent a body back — the body, behind a disclosure that opens and closes
 * on the same curve as everything else rather than snapping.
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
      {PROVIDERS.map((provider) => {
        const result = state.results[provider];
        return (
          <ListSection header={t(`ui.operations.provider.${provider}`)} key={provider}>
            {provider === "logs" ? (
              <ListCustomRow>
                <Input
                  aria-label={t("ui.operations.logSearch")}
                  maxLength={200}
                  onChange={(event) => state.setQuery(event.target.value)}
                  placeholder={t("ui.operations.logSearch")}
                  value={state.query}
                />
              </ListCustomRow>
            ) : null}
            <ListActionRow
              busy={state.pending === provider}
              label={t("ui.adminConsole.refresh")}
              onClick={() => void state.load(provider)}
            />
            {result ? (
              <ListRow
                label={t(
                  `ui.operations.providerStatus.${
                    result.status === "not-configured" ? "notConfigured" : result.status
                  }`,
                )}
                tone={result.error ? "destructive" : "default"}
                value={result.error}
              />
            ) : null}
            {result?.data ? (
              <Disclosure label={t("ui.operations.providerDetails")}>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all pb-3 text-xs">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </Disclosure>
            ) : null}
            {result?.nextCursor ? (
              <ListActionRow
                busy={state.pending === provider}
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
