"use client";

import * as React from "react";

import { useAdminReading } from "@/hooks/use-admin-reading";
import { useDraft } from "@/hooks/use-draft";
import { useRememberedState } from "@/hooks/use-remembered-state";
import { setOperationPolicies } from "@/lib/operation-policies";
import {
  fetchOperationSettings,
  saveOperationPolicies,
  type OperationsConsole,
} from "@/services/operations-console";
import type { OperationPolicies } from "@/generated/operations";

export type { OperationsConsole } from "@/services/operations-console";

interface PolicyReading {
  history: OperationsConsole["history"];
  revision: number;
  values: OperationPolicies;
}

export function useOperationPolicies() {
  const { remember, value: reading } = useRememberedState<PolicyReading | null>(
    "admin-policies",
    null,
  );
  const { error, loading: busy, read } = useAdminReading("admin-policies", "common.loadFailed");
  const stored = React.useMemo(() => reading ? {
    revision: reading.revision, values: reading.values,
  } : null, [reading]);
  const revision = reading?.revision ?? 0;

  const load = React.useCallback(() => read(
    () => fetchOperationSettings({ policiesOnly: true }),
    (snapshot) => {
      remember({
        history: snapshot.history,
        revision: snapshot.settings.revision,
        values: snapshot.settings.values,
      });
    },
  ), [read, remember]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const draft = useDraft<OperationsConsole["settings"]>({
    requireReason: true,
    save: async (value, reason, baseline) => {
      const saved = await saveOperationPolicies({ reason, revision: baseline.revision, values: value.values });
      setOperationPolicies(saved);
      remember((current) => ({
        history: current?.history ?? [],
        revision: saved.revision,
        values: saved.values,
      }));
      // Re-read the server-owned policy history without querying system diagnostics.
      void load();
      return saved;
    },
    source: stored,
  });

  return {
    draft,
    error,
    history: reading?.history ?? [],
    load,
    loading: reading === null && busy,
    revision,
  };
}
