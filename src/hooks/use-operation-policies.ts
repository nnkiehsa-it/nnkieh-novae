"use client";

import * as React from "react";

import { useDraft } from "@/hooks/use-draft";
import { useRememberedState } from "@/hooks/use-remembered-state";
import { setOperationPolicies } from "@/lib/operation-policies";
import {
  fetchOperationsConsole,
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
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const stored = reading?.values ?? null;
  const revision = reading?.revision ?? 0;

  const load = React.useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      // The settings and their history are two of the console's ten readings.
      // The screen is the settings, so it is drawn as soon as they land rather
      // than after the readings it does not show.
      const snapshot = await fetchOperationsConsole({ page: 0 }, {
        onPanel: (panel) => {
          if (panel.settings) {
            const settings = panel.settings;
            remember((current) => ({
              history: current?.history ?? [],
              revision: settings.revision,
              values: settings.values,
            }));
          }
          if (panel.history) {
            const history = panel.history;
            remember((current) => (current ? { ...current, history } : current));
          }
        },
      });
      remember({
        history: snapshot.history,
        revision: snapshot.settings.revision,
        values: snapshot.settings.values,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, [remember]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const draft = useDraft<OperationPolicies>({
    requireReason: true,
    save: async (values, reason) => {
      const saved = await saveOperationPolicies({ reason, revision, values });
      setOperationPolicies(saved);
      remember((current) => ({
        history: current?.history ?? [],
        revision: saved.revision,
        values: saved.values,
      }));
      // Only the history is re-read, and only because the server owns the actor
      // and the timestamp on the entry just written. Nothing else on the screen
      // is thrown away to learn it.
      void load();
      return saved.values;
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
