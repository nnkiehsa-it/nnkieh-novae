import { createElement, type ReactElement } from "react";
import { notifyManager, QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

// Query updates reach React inside the `act` that caused them.
notifyManager.setScheduler((callback) => callback());

/** Renders a hook probe the way the app does: under the one query client. */
export function withQueryClient(element: ReactElement) {
  return createElement(QueryClientProvider, { client: queryClient }, element);
}

export { queryClient };
