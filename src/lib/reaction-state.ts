export type ReactionDomain = "announcement" | "facility" | "issue";
export type ReactionSource = "detail" | "list" | "mutation";

export interface ReactionState {
  active: boolean;
  count: number;
}

interface ReactionEntry extends ReactionState {
  priority: number;
}

const reactionStates = new Map<string, ReactionEntry>();
const sourcePriority: Record<ReactionSource, number> = {
  list: 0,
  detail: 1,
  mutation: 2,
};

function reactionKey(scope: string | undefined, domain: ReactionDomain, id: string) {
  return `${scope || "anonymous"}|${domain}|${id}`;
}

export function reconcileReactionState(
  scope: string | undefined,
  domain: ReactionDomain,
  id: string,
  incoming: ReactionState,
  source: ReactionSource,
): ReactionState {
  const key = reactionKey(scope, domain, id);
  const priority = sourcePriority[source];
  const current = reactionStates.get(key);
  if (current && current.priority > priority) {
    return { active: current.active, count: current.count };
  }
  const next = { ...incoming, priority };
  reactionStates.set(key, next);
  return incoming;
}

export function recordReactionMutation(
  scope: string | undefined,
  domain: ReactionDomain,
  id: string,
  state: ReactionState,
) {
  return reconcileReactionState(scope, domain, id, state, "mutation");
}
