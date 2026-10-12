import * as React from "react";

/** Mounts on first visit, then stays mounted so leaving a view does not discard its draft. */
export function VisitedPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [visited, setVisited] = React.useState(active);
  if (active && !visited) setVisited(true);
  if (!visited) return null;
  return <div hidden={!active}>{children}</div>;
}
