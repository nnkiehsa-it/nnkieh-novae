"use client";

import * as React from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useDraft } from "@/hooks/use-draft";
import { useRememberedState } from "@/hooks/use-remembered-state";
import {
  listScopeMembers,
  lookupAccessMember,
  setUserAccessScope,
  type AccessScope,
  type AccessUser,
} from "@/services/access";

export type { AccessScope, AccessUser };

interface ScopeMembers {
  uids: string[];
}

interface ScopeReading {
  /** Everyone the screen can name, including people found by searching. */
  known: AccessUser[];
  uids: string[];
}

function scopeKey(scope: AccessScope | null) {
  if (!scope) return "admin-access:none";
  return scope.kind === "announcement"
    ? "admin-access:announcement"
    : `admin-access:${scope.kind}:${scope.categoryId}`;
}

/**
 * Who manages one area.
 *
 * Granting and revoking used to happen the instant a row was pressed, one
 * request per person. Here the screen holds the whole membership as a draft and
 * one save reconciles it, so a mis-click costs nothing and the audit trail
 * reflects a decision rather than a sequence of second thoughts.
 */
export function useAccessManagement() {
  const categories = useCategories();
  const { t } = useI18n();
  const [kind, setKind] = React.useState<AccessScope["kind"]>("issue");
  const [categoryId, setCategoryId] = React.useState("");
  const [candidate, setCandidate] = React.useState<AccessUser | null>(null);
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState("");

  const options = React.useMemo(
    () =>
      kind === "issue"
        ? categories.activeIssueCategories
        : kind === "facility"
          ? categories.activeFacilityCategories
          : [],
    [categories.activeFacilityCategories, categories.activeIssueCategories, kind],
  );

  const scope = React.useMemo<AccessScope | null>(
    () =>
      kind === "announcement"
        ? { kind }
        : categoryId
          ? { categoryId, kind }
          : null,
    [categoryId, kind],
  );

  const { remember, value: reading } = useRememberedState<ScopeReading | null>(
    scopeKey(scope),
    null,
  );
  const known = reading?.known ?? [];
  const stored = React.useMemo<ScopeMembers | null>(
    () => (reading ? { uids: reading.uids } : null),
    [reading],
  );

  React.useEffect(() => {
    setCategoryId("");
    setCandidate(null);
    setQuery("");
  }, [kind]);

  React.useEffect(() => {
    if (!categoryId && options.length === 1) setCategoryId(options[0]!.id);
  }, [categoryId, options]);

  const load = React.useCallback(async () => {
    if (!scope) return;
    setBusy(true);
    setError("");
    try {
      await listScopeMembers(scope, {
        onUsers: (members) => remember({ known: members, uids: members.map((member) => member.uid) }),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("ui.common.loadFailed"));
    } finally {
      setBusy(false);
    }
  }, [remember, scope, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const draft = useDraft<ScopeMembers>({
    save: async (value) => {
      if (!scope) return value;
      const before = new Set(stored?.uids ?? []);
      const after = new Set(value.uids);
      const granted = value.uids.filter((uid) => !before.has(uid));
      const revoked = [...before].filter((uid) => !after.has(uid));
      for (const uid of granted) await setUserAccessScope(uid, scope, true);
      for (const uid of revoked) await setUserAccessScope(uid, scope, false);
      remember((current) => ({ known: current?.known ?? [], uids: value.uids }));
      return { uids: value.uids };
    },
    source: stored,
  });

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setCandidate(null);
    try {
      await lookupAccessMember(query.trim(), {
        onUsers: (users) => {
          const found = users[0] ?? null;
          setCandidate(found);
          if (!found) return;
          remember((current) => ({
            known: [...(current?.known ?? []).filter((member) => member.uid !== found.uid), found],
            uids: current?.uids ?? [],
          }));
        },
      });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.access.searchFailed"));
    } finally {
      setSearching(false);
    }
  }

  const memberUids = draft.value?.uids ?? [];

  return {
    candidate,
    categoryId,
    draft,
    error,
    grant: (uid: string) =>
      draft.update((current) =>
        current.uids.includes(uid) ? current : { uids: [...current.uids, uid] },
      ),
    hasScope: (uid: string) => memberUids.includes(uid),
    kind,
    known,
    load,
    loading: reading === null && busy,
    members: memberUids
      .map((uid) => known.find((member) => member.uid === uid))
      .filter((member): member is AccessUser => member !== undefined),
    options,
    query,
    revoke: (uid: string) =>
      draft.update((current) => ({ uids: current.uids.filter((entry) => entry !== uid) })),
    scope,
    search,
    searching,
    setCategoryId,
    setKind,
    setQuery,
  };
}
