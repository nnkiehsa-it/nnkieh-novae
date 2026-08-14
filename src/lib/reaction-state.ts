export interface ReactionState {
  active: boolean;
  count: number;
}

export function toggleReactionState(state: ReactionState): ReactionState {
  const active = !state.active;
  return {
    active,
    count: Math.max(0, state.count + (active ? 1 : -1)),
  };
}
