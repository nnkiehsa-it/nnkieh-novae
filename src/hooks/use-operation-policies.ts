"use client";

import * as React from "react";

import { useDraft } from "@/hooks/use-draft";
import { setOperationPolicies } from "@/lib/operation-policies";
import {
  fetchOperationsConsole,
  saveOperationPolicies,
  type OperationsConsole,
} from "@/services/operations-console";
import type { OperationPolicies } from "@/generated/operations";

export type { OperationsConsole } from "@/services/operations-console";

export function useOperationPolicies() {
  const [stored, setStored] = React.useState<OperationPolicies | null>(null);
  const [revision, setRevision] = React.useState(0);
  const [history, setHistory] = React.useState<OperationsConsole["history"]>([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const snapshot = await fetchOperationsConsole({ page: 0 });
      setStored(snapshot.settings.values);
      setRevision(snapshot.settings.revision);
      setHistory(snapshot.history);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const draft = useDraft<OperationPolicies>({
    requireReason: true,
    save: async (values, reason) => {
      const saved = await saveOperationPolicies({ reason, revision, values });
      setOperationPolicies(saved.values);
      setRevision(saved.revision);
      setStored(saved.values);
      // Only the history is re-read, and only because the server owns the actor
      // and the timestamp on the entry just written. Nothing else on the screen
      // is thrown away to learn it.
      void load();
      return saved.values;
    },
    source: stored,
  });

  return { draft, error, history, load, loading, revision };
}
