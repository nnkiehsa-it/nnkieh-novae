"use client";

import * as React from "react";
import { useAdminReading } from "@/hooks/use-admin-reading";
import { useDraft } from "@/hooks/use-draft";
import { useRememberedState } from "@/hooks/use-remembered-state";
import { accessScopeKey, listScopeMembers, lookupAccessMember, saveScopeMembers, type AccessScope, type AccessUser } from "@/services/access";
export { accessScopeKey } from "@/services/access";
export type { AccessScope, AccessUser } from "@/services/access";

interface ScopeMembers {
  revision: string;
  uids: string[];
}
interface ScopeReading extends ScopeMembers {
  known: AccessUser[];
}

/** Mounted with the scope as its React key; a draft never belongs to two scopes. */
export function useScopeAccess(scope: AccessScope | null) {
  const key = accessScopeKey(scope);
  const { remember, value: reading } = useRememberedState<ScopeReading | null>(key, null);
  const membership = useAdminReading(key, "ui.common.loadFailed");
  const { read: readMembers } = membership;
  const lookup = useAdminReading(`${key}:lookup`, "ui.access.searchFailed");
  const { invalidate: invalidateLookup } = lookup;
  const [candidate, setCandidate] = React.useState<AccessUser | null>(null);
  const [query, setQuery] = React.useState("");
  const [searched, setSearched] = React.useState(false);
  const stored = React.useMemo(() => reading ? { revision: reading.revision, uids: reading.uids } : null, [reading]);

  const load = React.useCallback(() => {
    invalidateLookup();
    setCandidate(null);
    setSearched(false);
    if (!scope) return Promise.resolve();
    return readMembers(() => listScopeMembers(scope), (result) => remember((current) => ({
      known: [...new Map([...(current?.known ?? []), ...result.users].map((user) => [user.uid, user])).values()],
      revision: result.revision,
      uids: result.users.map((user) => user.uid),
    })));
  }, [invalidateLookup, readMembers, remember, scope]);
  React.useEffect(() => { void load(); }, [load]);

  const draft = useDraft<ScopeMembers>({
    save: async (value, _reason, baseline) => {
      if (!scope) return value;
      const before = new Set(baseline.uids);
      const after = new Set(value.uids);
      const changes = [
        ...value.uids.filter((uid) => !before.has(uid)).map((uid) => ({ uid, grant: true })),
        ...baseline.uids.filter((uid) => !after.has(uid)).map((uid) => ({ uid, grant: false })),
      ];
      membership.invalidate();
      const saved = await saveScopeMembers(scope, changes, baseline.revision);
      const next = { revision: saved.revision, uids: saved.users.map((user) => user.uid) };
      if (membership.isActive()) remember((current) => ({
        ...next,
        known: [...new Map([...(current?.known ?? []), ...saved.users].map((user) => [user.uid, user])).values()],
      }));
      return next;
    },
    source: stored,
  });

  const search = () => {
    if (!query.trim()) return Promise.resolve();
    setCandidate(null);
    setSearched(false);
    return lookup.read(() => lookupAccessMember(query.trim()), (result) => {
      const found = result.users[0] ?? null;
      setCandidate(found);
      setSearched(true);
      if (found) remember((current) => current && ({
        ...current,
        known: [...current.known.filter((user) => user.uid !== found.uid), found],
      }));
    });
  };
  const known = reading?.known ?? [];
  const memberUids = draft.value?.uids ?? [];
  const before = new Set(draft.baseline?.uids ?? []);
  const after = new Set(memberUids);
  const changes = [
    ...memberUids.filter((uid) => !before.has(uid)).map((uid) => ({ key: uid, before: false, after: true })),
    ...[...before].filter((uid) => !after.has(uid)).map((uid) => ({ key: uid, before: true, after: false })),
  ];
  return {
    candidate, changes, draft, error: membership.error, known, load,
    loading: membership.loading,
    members: memberUids.map((uid) => known.find((user) => user.uid === uid)).filter((user): user is AccessUser => user !== undefined),
    grant: (uid: string) => draft.update((current) => current.uids.includes(uid) ? current : { ...current, uids: [...current.uids, uid] }),
    revoke: (uid: string) => draft.update((current) => ({ ...current, uids: current.uids.filter((entry) => entry !== uid) })),
    hasScope: (uid: string) => memberUids.includes(uid),
    query, search, searched, searchError: lookup.error, searching: lookup.loading,
    setQuery: (next: string) => { lookup.invalidate(); setQuery(next); setCandidate(null); setSearched(false); },
  };
}
