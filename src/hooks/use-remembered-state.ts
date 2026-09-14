"use client";

import * as React from "react";

import { useSession } from "@/hooks/use-session";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";

interface RememberedState<T> {
  cold: boolean;
  key: string;
  scope: string | undefined;
  value: T;
}

function read<T>(scope: string | undefined, key: string, fallback: T): RememberedState<T> {
  const remembered = getViewMemory<T>(scope, key);
  return { cold: remembered === null, key, scope, value: remembered ?? fallback };
}

/**
 * What an administration panel already knows, kept while the reader looks away.
 *
 * Every console used to start from nothing: leaving the screen, or merely moving
 * to the next view of the same screen, threw the reading away and the panel came
 * back as a skeleton that asked the backend the same question again. The reading
 * lives in view memory instead, so a panel that has been read once keeps showing
 * what it says and only re-reads when the reader asks it to. `cold` is the one
 * case where there is genuinely nothing to show and a first read is owed.
 */
export function useRememberedState<T>(key: string, fallback: T) {
  const session = useSession();
  const scope = session.user?.uid;
  const [state, setState] = React.useState(() => read(scope, key, fallback));

  if (state.key !== key || state.scope !== scope) setState(read(scope, key, fallback));

  const remember = React.useCallback(
    (update: T | ((current: T) => T)) => {
      setState((previous) => ({
        cold: false,
        key,
        scope,
        value:
          typeof update === "function"
            ? (update as (current: T) => T)(previous.value)
            : update,
      }));
    },
    [key, scope],
  );

  React.useEffect(() => {
    if (!state.cold) setViewMemory(state.scope, state.key, state.value);
  }, [state]);

  return { cold: state.cold, remember, value: state.value };
}
