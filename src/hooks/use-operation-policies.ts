import * as React from "react";

import { useAdminReading } from "@/hooks/use-admin-reading";
import { useDraft } from "@/hooks/use-draft";
import { useRememberedState } from "@/hooks/use-remembered-state";
import { setOperationPolicies } from "@/lib/operation-policies";
import {
  fetchOperationPolicies,
  saveOperationPolicies,
  type PolicyChange,
} from "@/services/operations-console";
import type { PolicySnapshot } from "@shared/contracts/operations.ts";
import { validOperationSettings } from "@/lib/admin-setting-presets";

export type { PolicyChange } from "@/services/operations-console";

interface PolicyReading extends PolicySnapshot {
  history: PolicyChange[];
}

export function useOperationPolicies() {
  const { remember, value: reading } = useRememberedState<PolicyReading | null>(
    "admin-policies",
    null,
  );
  const { error, invalidate, isActive, loading: busy, read } = useAdminReading("admin-policies", "common.loadFailed");
  const stored = React.useMemo(() => reading ? {
    revision: reading.revision, values: reading.values,
  } : null, [reading]);
  const revision = reading?.revision ?? 0;

  const load = React.useCallback(() => read(
    fetchOperationPolicies,
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

  const draft = useDraft<PolicySnapshot>({
    requireReason: true,
    save: async (value, reason, baseline) => {
      invalidate();
      const saved = await saveOperationPolicies({ reason, revision: baseline.revision, values: value.values });
      if (!isActive()) return saved;
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
    validate: (value) => validOperationSettings(value.values),
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
