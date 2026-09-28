"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { toggleReactionState, type ReactionState } from "@/lib/reaction-state";
import { hasPendingContentEntityMutation, type ContentEntityDomain } from "@/lib/content-entity-store";

interface ReactionRequest {
  id: string;
  previous: ReactionState;
  apply: (state: ReactionState, pending: boolean) => void;
  request: (active: boolean) => Promise<ReactionState>;
  errorMessage: string;
  onSuccess?: () => void;
}

export function useOptimisticReaction(scope: string | undefined, domain: ContentEntityDomain) {
  const pending = useRef(new Set<string>());
  const [, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [burstById, setBurstById] = useState<Record<string, number>>({});

  async function run({ id, previous, apply, request, errorMessage, onSuccess }: ReactionRequest) {
    if (isBusy(id)) return;
    pending.current.add(id);
    setBusyIds(new Set(pending.current));
    const optimistic = toggleReactionState(previous);
    apply(optimistic, true);
    if (optimistic.active) setBurstById((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
    try {
      apply(await request(optimistic.active), false);
      onSuccess?.();
    } catch (error) {
      apply(previous, false);
      toast.error(error instanceof Error ? error.message : errorMessage);
    } finally {
      pending.current.delete(id);
      setBusyIds(new Set(pending.current));
    }
  }

  function isBusy(id: string) {
    return pending.current.has(id) || hasPendingContentEntityMutation(scope, domain, id);
  }

  return { isBusy, burstById, run };
}
