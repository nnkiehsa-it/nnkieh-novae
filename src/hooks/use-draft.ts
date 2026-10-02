"use client";

import * as React from "react";

import { ACTION_SUCCESS_HOLD_MS } from "@/hooks/use-action-feedback";
import { diffDraft, rebaseDraft, type DraftChange } from "@/lib/draft-diff";
import type { DraftStatus } from "@/types/draft";

export interface DraftImpact {
  details: Record<string, number>;
  updatedDetails?: Record<string, number>;
  totalDeletedRows?: number;
  totalUpdatedRows?: number;
  totalEstimatedRows: number;
}

export interface Draft<T> {
  baseline: T | null;
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
  estimate?: (value: T, baseline: T) => Promise<DraftImpact | null>;
  /** A surface that refuses to save without a written reason. */
  requireReason?: boolean;
  /** Performs the write and resolves with what was actually stored. */
  save: (value: T, reason: string, baseline: T) => Promise<T>;
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
  const [review, setReview] = React.useState<{
    impact: DraftImpact; value: T; reason: string; baseline: T;
  } | null>(null);
  const busy = React.useRef(false);
  const edits = React.useRef(0);
  const successTimer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(successTimer.current), []);

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

  async function persist(next: T, savedReason: string, baseline: T) {
    setStatus("saving");
    setError("");
    try {
      const stored = await save(next, savedReason.trim(), baseline);
      setSession((current) => ({
        baseline: stored,
        value: current.value === null ? null : rebaseDraft(next, current.value, stored),
      }));
      setReason((current) => current === savedReason ? "" : current);
      setStatus("saved");
      window.clearTimeout(successTimer.current);
      successTimer.current = window.setTimeout(() => setStatus((current) => current === "saved" ? "clean" : current), ACTION_SUCCESS_HOLD_MS);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("failed");
    }
  }

  async function submit() {
    if (value === null || session.baseline === null || !dirty || !valid || busy.current) return;
    busy.current = true;
    const edit = edits.current;
    setReview(null);
    setError("");
    setStatus("saving");
    try {
      const estimated = estimate ? await estimate(value, session.baseline) : null;
      if (edit !== edits.current) {
        setStatus("dirty");
        return;
      }
      if (estimated && estimated.totalEstimatedRows > 0) {
        setReview({ impact: estimated, value, reason, baseline: session.baseline });
        setStatus("dirty");
        return;
      }
      await persist(value, reason, session.baseline);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("failed");
    } finally {
      busy.current = false;
    }
  }

  return {
    baseline: session.baseline,
    cancel: () => setReview(null),
    changes,
    confirm: async () => {
      if (!review || busy.current) return;
      busy.current = true;
      setReview(null);
      try { await persist(review.value, review.reason, review.baseline); }
      finally { busy.current = false; }
    },
    dirty,
    error,
    impact: review?.impact ?? null,
    reason,
    reset: () => {
      edits.current += 1;
      setReview(null);
      setSession((current) => ({ ...current, value: current.baseline }));
      setReason("");
      setError("");
      setStatus("clean");
    },
    setReason: (next) => { edits.current += 1; setReview(null); setReason(next); },
    status: (status === "clean" || status === "saved") && dirty ? "dirty" : status,
    submit,
    update: (patch) => {
      edits.current += 1;
      setReview(null);
      setError("");
      if (!busy.current) setStatus("clean");
      setSession((current) => {
        if (current.value === null) return current;
        return {
          baseline: current.baseline,
          value:
            typeof patch === "function"
              ? (patch as (value: T) => T)(current.value)
              : { ...current.value, ...patch },
        };
      });
    },
    valid,
    value,
  };
}

function differences<T>({ baseline, value }: Session<T>) {
  return baseline === null || value === null ? [] : diffDraft(baseline, value);
}
