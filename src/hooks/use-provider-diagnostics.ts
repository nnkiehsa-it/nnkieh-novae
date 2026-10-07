"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRememberedState } from "@/hooks/use-remembered-state";
import { useAdminReading } from "@/hooks/use-admin-reading";
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
  const { cold, refresh, remember, value } = useRememberedState<DiagnosticsReading>(
    "admin-providers",
    { activeQuery: "", results: {} },
  );
  const [query, setQuery] = useState(value.activeQuery);
  const cloudinary = useAdminReading("admin-provider:cloudinary", "common.loadFailed");
  const cloudflare = useAdminReading("admin-provider:cloudflare", "common.loadFailed");
  const logs = useAdminReading("admin-provider:logs", "common.loadFailed");
  const readers = useMemo(() => ({ cloudinary: cloudinary.read, cloudflare: cloudflare.read, logs: logs.read }),
    [cloudinary.read, cloudflare.read, logs.read]);
  const pending = useRef(new Map<string, { read: typeof cloudinary.read; promise: Promise<void> }>());

  const load = useCallback(
    (provider: DiagnosticProvider, next = false) => {
      const previous = value.results[provider];
      if (next && !previous?.nextCursor) return Promise.resolve();
      const payload = {
          provider,
          ...(provider === "logs" ? { query: next ? value.activeQuery : query } : {}),
          ...(next && previous?.nextCursor
            ? { cursor: previous.nextCursor, until: previous.until }
            : {}),
      };
      const key = JSON.stringify(payload);
      const read = readers[provider];
      const existing = pending.current.get(key);
      if (existing?.read === read) return existing.promise;
      const promise = read(async () => {
        const result = await getProviderDiagnostics(payload);
        if (result.status === "unavailable") throw new Error(result.error);
        return result;
      }, (result) => remember((current) => ({
          activeQuery: provider === "logs" && !next ? query : current.activeQuery,
          results: { ...current.results, [provider]: result },
      }))).finally(() => {
        if (pending.current.get(key)?.promise === promise) pending.current.delete(key);
      });
      pending.current.set(key, { read, promise });
      return promise;
    },
    [query, readers, remember, value],
  );
  const latestLoad = useRef(load);
  useEffect(() => { latestLoad.current = load; }, [load]);

  useEffect(() => {
    if (!cold && !refresh) return;
    for (const provider of READ_ON_ARRIVAL) void latestLoad.current(provider);
  }, [cold, refresh, readers]);

  return {
    busy: (provider: DiagnosticProvider) => ({ cloudinary, cloudflare, logs })[provider].loading,
    error: cloudinary.error || cloudflare.error || logs.error,
    load,
    query,
    results: value.results,
    setQuery,
  };
}
