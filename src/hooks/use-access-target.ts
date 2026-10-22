import * as React from "react";
import { pushAddress, replaceAddress } from "@/lib/app-navigation";
import { useAppLocation } from "@/hooks/use-app-location";
import type { AccessScope } from "@/services/access";

interface AccessTarget {
  kind: AccessScope["kind"];
  issueId: string;
  facilityId: string;
}

/** The URL keeps separate category choices for each content type. */
export function useAccessTarget() {
  const params = useAppLocation().search;
  const requestedKind = params.get("scope");
  const kind = ["issue", "facility", "announcement"].find((value) => value === requestedKind) as AccessScope["kind"] | undefined;
  const issueId = params.get("issueCategory") ?? "";
  const facilityId = params.get("facilityCategory") ?? "";
  const target = React.useMemo<AccessTarget>(() => ({ kind: kind ?? "issue", issueId, facilityId }), [facilityId, issueId, kind]);
  const change = React.useCallback((next: AccessTarget, replace = false) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries({
      scope: next.kind === "issue" ? "" : next.kind,
      issueCategory: next.issueId,
      facilityCategory: next.facilityId,
    })) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    const address = `${url.pathname}${url.search}${url.hash}`;
    if (replace) replaceAddress(address);
    else pushAddress(address);
  }, []);
  return [target, change] as const;
}
