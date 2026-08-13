"use client";

import * as React from "react";

interface RequestToken {
  generation: number;
  queryKey: string;
}

export function usePagedRequestGuard() {
  const state = React.useRef({
    generation: 0,
    inFlight: false,
    queryKey: "",
  });

  const begin = React.useCallback((queryKey: string): RequestToken | null => {
    if (state.current.queryKey !== queryKey) {
      state.current = {
        generation: state.current.generation + 1,
        inFlight: false,
        queryKey,
      };
    }
    if (state.current.inFlight) return null;
    state.current.inFlight = true;
    return { generation: state.current.generation, queryKey };
  }, []);

  const isCurrent = React.useCallback(
    (token: RequestToken) =>
      state.current.generation === token.generation &&
      state.current.queryKey === token.queryKey,
    [],
  );

  const restart = React.useCallback((queryKey: string) => {
    state.current = {
      generation: state.current.generation + 1,
      inFlight: false,
      queryKey,
    };
  }, []);

  const finish = React.useCallback(
    (token: RequestToken) => {
      if (!isCurrent(token)) return false;
      state.current.inFlight = false;
      return true;
    },
    [isCurrent],
  );

  return React.useMemo(
    () => ({ begin, finish, isCurrent, restart }),
    [begin, finish, isCurrent, restart],
  );
}
