interface UnsavedChanges {
  count: number;
  discard: () => void;
}

const empty: UnsavedChanges = { count: 0, discard: () => undefined };

let current = empty;
const listeners = new Set<() => void>();

function publish() {
  for (const listener of listeners) listener();
}

/**
 * What the screen would lose if the reader left right now.
 *
 * One screen owns one draft, so one value is enough. It lives outside React so
 * that the guard in the administration shell and the screen that holds the
 * draft do not have to be related to each other.
 */
export function setUnsavedChanges(next: UnsavedChanges | null) {
  current = next && next.count > 0 ? next : empty;
  publish();
}

export function getUnsavedChanges() {
  return current;
}

export function subscribeUnsavedChanges(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
