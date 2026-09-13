"use client";

import * as React from "react";

import { ACTION_SUCCESS_HOLD_MS } from "@/hooks/use-action-feedback";
import { diffDraft, type DraftChange } from "@/lib/draft-diff";
import type { DraftStatus } from "@/types/draft";

export interface DraftImpact {
  details: Record<string, number>;
  totalEstimatedRows: number;
}

export interface Draft<T> {
  cancel: () => void;
  changes: DraftChange[];
  confirm: () => Promise<void>;
  dirty: boolean;
  error: string;
  /** Non-null only while an estimate is waiting for the reader to confirm. */
  impact: DraftImpact | null;
  reason: string;
  reset: () => void;
  setReason: (reason: string) => void;
  status: DraftStatus;
  submit: () => Promise<void>;
  update: (patch: Partial<T> | ((current: T) => T)) => void;
  valid: boolean;
  value: T | null;
}

interface Session<T> {
  baseline: T | null;
  value: T | null;
}

/**
 * One editing session over a stored value.
 *
 * Nothing reaches the backend until `submit` is called, so a screen built on
 * this can be changed, reconsidered and abandoned without consequence. The
 * draft also knows exactly what it would change, which is what lets the reader
 * be shown the decision instead of being asked to trust a button.
 */
export function useDraft<T>({
  estimate,
  requireReason = false,
  save,
  source,
  validate,
}: {
  /** Runs before the write; anything it reports has to be confirmed first. */
  estimate?: (value: T) => Promise<DraftImpact | null>;
  /** A surface that refuses to save without a written reason. */
  requireReason?: boolean;
  /** Performs the write and resolves with what was actually stored. */
  save: (value: T, reason: string) => Promise<T>;
  /** The stored value. A new one restarts the draft, unless it is being edited. */
  source: T | null;
  validate?: (value: T) => boolean;
}): Draft<T> {
  const [session, setSession] = React.useState<Session<T>>({
    baseline: source,
    value: source,
  });
  const [status, setStatus] = React.useState<DraftStatus>("clean");
  const [error, setError] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [impact, setImpact] = React.useState<DraftImpact | null>(null);

  // A newly loaded value replaces the draft only while there is nothing to
  // lose. A refresh that lands mid-edit used to take back what had just been
  // typed, and the screen would quietly forget the decision it was showing.
  React.useEffect(() => {
    setSession((current) => {
      if (differences(current).length > 0) return current;
      setStatus("clean");
      return { baseline: source, value: source };
    });
  }, [source]);

  const changes = React.useMemo(() => differences(session), [session]);
  const dirty = changes.length > 0;
  const value = session.value;
  const valid =
    value !== null
    && (validate ? validate(value) : true)
    && (!requireReason || reason.trim().length > 0);

  async function persist(next: T) {
    setStatus("saving");
    setError("");
    try {
      const stored = await save(next, reason.trim());
      setSession({ baseline: stored, value: stored });
      setReason("");
      setStatus("saved");
      window.setTimeout(() => setStatus("clean"), ACTION_SUCCESS_HOLD_MS);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("failed");
    }
  }

  async function submit() {
    if (value === null || !valid || status === "saving") return;
    if (!estimate) {
      await persist(value);
      return;
    }
    setStatus("saving");
    try {
      const estimated = await estimate(value);
      if (estimated && estimated.totalEstimatedRows > 0) {
        setImpact(estimated);
        setStatus("dirty");
        return;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("failed");
      return;
    }
    await persist(value);
  }

  return {
    cancel: () => setImpact(null),
    changes,
    confirm: async () => {
      setImpact(null);
      if (value !== null) await persist(value);
    },
    dirty,
    error,
    impact,
    reason,
    reset: () => {
      setSession((current) => ({ baseline: current.baseline, value: current.baseline }));
      setReason("");
      setError("");
      setStatus("clean");
    },
    setReason,
    status: status === "clean" && dirty ? "dirty" : status,
    submit,
    update: (patch) =>
      setSession((current) => {
        if (current.value === null) return current;
        return {
          baseline: current.baseline,
          value:
            typeof patch === "function"
              ? (patch as (value: T) => T)(current.value)
              : { ...current.value, ...patch },
        };
      }),
    valid,
    value,
  };
}

function differences<T>({ baseline, value }: Session<T>) {
  return baseline === null || value === null ? [] : diffDraft(baseline, value);
}
