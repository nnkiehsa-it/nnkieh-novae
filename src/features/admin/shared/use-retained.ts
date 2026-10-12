import * as React from "react";

/**
 * The last value that was not null. A sheet reads its content through this so
 * it keeps showing the record it was opened on while it animates closed.
 */
export function useRetained<T>(value: T | null) {
  const [retained, setRetained] = React.useState(value);
  if (value !== null && value !== retained) setRetained(value);
  return value ?? retained;
}
