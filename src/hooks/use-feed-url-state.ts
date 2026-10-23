import { useCallback, useState } from "react";
import { useAppLocation } from "@/hooks/use-app-location";
import { pushAddress } from "@/lib/app-navigation";
import { normalizeFeedQuery, updateFeedUrl } from "@/lib/feed-url-state";

export function useFeedUrlState() {
  const { pathname, search: params } = useAppLocation();
  const committedQuery = normalizeFeedQuery(params.get("q") ?? "");
  const identity = `${pathname}?${params.toString()}`;
  const [input, setInput] = useState({ identity, value: committedQuery });
  // URL navigation discards unapplied input; going Back must restore the shared query.
  if (input.identity !== identity) setInput({ identity, value: committedQuery });
  const query = input.identity === identity ? input.value : committedQuery;

  const updateParams = useCallback((values: Record<string, string | null>) => {
    pushAddress(updateFeedUrl(window.location.href, values));
  }, []);

  return {
    params, committedQuery, query, updateParams,
    setQuery: (value: string) => setInput({ identity, value }),
    setCommittedQuery: (value: string) => {
      const normalized = normalizeFeedQuery(value);
      setInput({ identity, value: normalized });
      updateParams({ q: normalized || null });
    },
  };
}
