"use client";

import { useCallback, useEffect, useState } from "react";

import { useRememberedState } from "@/hooks/use-remembered-state";
import {
  getProviderDiagnostics,
  type ProviderDiagnostic,
} from "@/services/operations-console";

export type { ProviderDiagnostic } from "@/services/operations-console";

export const DIAGNOSTIC_PROVIDERS = ["cloudinary", "cloudflare", "logs"] as const;

export type DiagnosticProvider = (typeof DIAGNOSTIC_PROVIDERS)[number];

/**
 * The providers that answer as soon as the panel is opened.
 *
 * Cloudinary and the Worker report standing figures — a plan and a day of
 * traffic — which is what the reader came for. The log stream is a search: an
 * unasked-for search of the last day costs a query against a hundred events to
 * show something nobody requested, so it waits to be asked.
 */
const READ_ON_ARRIVAL: readonly DiagnosticProvider[] = ["cloudinary", "cloudflare"];

interface DiagnosticsReading {
  activeQuery: string;
  results: Partial<Record<DiagnosticProvider, ProviderDiagnostic>>;
}

/**
 * What the outside services last said.
 *
 * The panel used to be empty until each provider was asked by hand, and it
 * emptied itself again as soon as the reader looked at another view. It asks
 * the reporting providers once now, keeps the answers, and re-asks only on
 * request.
 */
export function useProviderDiagnostics() {
  const { cold, remember, value } = useRememberedState<DiagnosticsReading>(
    "admin-providers",
    { activeQuery: "", results: {} },
  );
  const [query, setQuery] = useState(value.activeQuery);
  const [pending, setPending] = useState<readonly string[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(
    async (provider: DiagnosticProvider, next = false) => {
      const previous = value.results[provider];
      setPending((current) => [...current, provider]);
      setError("");
      try {
        const result = await getProviderDiagnostics({
          provider,
          ...(provider === "logs" ? { query: next ? value.activeQuery : query } : {}),
          ...(next && previous?.nextCursor
            ? { cursor: previous.nextCursor, until: previous.until }
            : {}),
        });
        remember((current) => ({
          activeQuery: provider === "logs" && !next ? query : current.activeQuery,
          results: { ...current.results, [provider]: result },
        }));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setPending((current) => current.filter((entry) => entry !== provider));
      }
    },
    [query, remember, value],
  );

  useEffect(() => {
    if (!cold) return;
    for (const provider of READ_ON_ARRIVAL) void load(provider);
  }, [cold, load]);

  return {
    busy: (provider: DiagnosticProvider) => pending.includes(provider),
    error,
    load,
    query,
    results: value.results,
    setQuery,
  };
}
