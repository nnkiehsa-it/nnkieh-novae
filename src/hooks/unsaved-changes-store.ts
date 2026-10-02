interface UnsavedChanges {
  busy?: boolean;
  count: number;
  discard: () => void;
}

const empty: UnsavedChanges = { count: 0, discard: () => undefined };

let current = empty;
const legacyOwner = Symbol("legacy-draft");
const drafts = new Map<symbol, UnsavedChanges & { group?: string }>();
const listeners = new Set<() => void>();

function publish() {
  for (const listener of listeners) listener();
}

/**
 * What the screen would lose if the reader left right now.
 *
 * A screen can retain several visited editors. Each draft registers separately so
 * that the guard in the administration shell and the screen that holds the
 * draft do not have to be related to each other.
 */
export function setUnsavedChanges(next: UnsavedChanges | null, owner = legacyOwner, group?: string) {
  if (next && (next.count > 0 || next.busy)) drafts.set(owner, { ...next, group });
  else drafts.delete(owner);
  current = summarize([...drafts.values()]);
  publish();
}

export function getUnsavedChanges(group?: string) {
  return group === undefined ? current : summarize([...drafts.values()].filter((draft) => draft.group === group));
}

function summarize(entries: UnsavedChanges[]): UnsavedChanges {
  return entries.length === 0 ? empty : {
    busy: entries.some((draft) => draft.busy),
    count: entries.reduce((total, draft) => total + draft.count, 0),
    discard: () => { for (const draft of entries) draft.discard(); },
  };
}

export function subscribeUnsavedChanges(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
