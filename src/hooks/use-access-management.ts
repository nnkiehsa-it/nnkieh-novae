"use client";

import * as React from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useDraft } from "@/hooks/use-draft";
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
  const [known, setKnown] = React.useState<AccessUser[]>([]);
  const [stored, setStored] = React.useState<ScopeMembers | null>(null);
  const [candidate, setCandidate] = React.useState<AccessUser | null>(null);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
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

  React.useEffect(() => {
    setCategoryId("");
    setCandidate(null);
    setQuery("");
  }, [kind]);

  React.useEffect(() => {
    if (!categoryId && options.length === 1) setCategoryId(options[0]!.id);
  }, [categoryId, options]);

  const load = React.useCallback(async () => {
    if (!scope) {
      setKnown([]);
      setStored(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const members = (await listScopeMembers(scope)).users;
      setKnown(members);
      setStored({ uids: members.map((member) => member.uid) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("ui.common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [scope, t]);

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
      const next = { uids: value.uids };
      setStored(next);
      return next;
    },
    source: stored,
  });

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setCandidate(null);
    try {
      const found = (await lookupAccessMember(query.trim())).users[0] ?? null;
      setCandidate(found);
      if (found)
        setKnown((current) =>
          current.some((member) => member.uid === found.uid) ? current : [...current, found],
        );
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
    loading,
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
