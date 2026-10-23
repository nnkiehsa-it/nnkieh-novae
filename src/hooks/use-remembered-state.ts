import * as React from "react";
import { skipToken, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

/**
 * What an administration panel already knows, kept while the reader looks away.
 *
 * A panel that has been read once keeps showing what it says when the reader
 * comes back, and only re-reads when the reader asks it to or the reading has
 * aged past `viewMemoryMinutes` (`refresh`). `cold` is the one case where there
 * is genuinely nothing to show and a first read is owed.
 */
export function useRememberedState<T>(key: string, fallback: T) {
  const queryKey = React.useMemo(() => ["remembered", key], [key]);
  // Nothing is fetched under this key: a panel writes what it read with `remember`.
  const query = useQuery<T>({ queryKey, queryFn: skipToken });
  const remembered = query.data !== undefined;
  // Panels pass a fresh fallback each render; only the key names the reading.
  const fallbackRef = React.useRef(fallback);
  React.useEffect(() => {
    fallbackRef.current = fallback;
  });

  const remember = React.useCallback(
    (update: T | ((current: T) => T)) => {
      queryClient.setQueryData<T>(queryKey, (current) =>
        typeof update === "function" ? (update as (current: T) => T)(current ?? fallbackRef.current) : update);
    },
    [queryKey],
  );

  return { cold: !remembered, refresh: remembered && query.isStale, remember, value: query.data ?? fallback };
}
