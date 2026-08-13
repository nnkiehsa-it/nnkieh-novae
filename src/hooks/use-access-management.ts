"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import {
  listScopeMembers,
  lookupAccessMember,
  setUserAccessScope,
  type AccessScope,
  type AccessUser,
} from "@/services/access";

export type { AccessScope, AccessUser };

export function useAccessManagement() {
  const categories = useCategories();
  const { t } = useI18n();
  const [kind, setKind] = React.useState<AccessScope["kind"]>("issue");
  const options = React.useMemo(
    () =>
      kind === "issue"
        ? categories.activeIssueCategories
        : kind === "facility"
          ? categories.activeFacilityCategories
          : [],
    [categories.activeFacilityCategories, categories.activeIssueCategories, kind],
  );
  const [categoryId, setCategoryId] = React.useState("");
  const [members, setMembers] = React.useState<AccessUser[]>([]);
  const [candidate, setCandidate] = React.useState<AccessUser | null>(null);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [savingUid, setSavingUid] = React.useState("");
  const [error, setError] = React.useState("");
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
      setMembers([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setMembers((await listScopeMembers(scope)).users);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("ui.common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [scope, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setCandidate((await lookupAccessMember(query.trim())).users[0] ?? null);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : t("ui.access.searchFailed"),
      );
    } finally {
      setSearching(false);
    }
  }

  function hasScope(user: AccessUser) {
    if (kind === "announcement") return user.roles.includes("announcement-manager");
    if (kind === "issue") return user.managedIssueCategoryIds.includes(categoryId);
    return user.managedFacilityCategoryIds.includes(categoryId);
  }

  async function save(user: AccessUser, grant: boolean) {
    if (!scope) return;
    setSavingUid(user.uid);
    try {
      const result = await setUserAccessScope(user.uid, scope, grant);
      const updated = { ...user, ...result };
      setMembers((current) =>
        grant
          ? current.some((member) => member.uid === user.uid)
            ? current.map((member) => (member.uid === user.uid ? updated : member))
            : [...current, updated]
          : current.filter((member) => member.uid !== user.uid),
      );
      setCandidate((current) =>
        current?.uid === user.uid ? { ...current, ...result } : current,
      );
      toast.success(grant ? t("ui.access.granted") : t("ui.access.revoked"));
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : t("ui.access.updateFailed"),
      );
    } finally {
      setSavingUid("");
    }
  }

  return {
    candidate,
    categoryId,
    error,
    hasScope,
    kind,
    load,
    loading,
    members,
    options,
    query,
    save,
    savingUid,
    search,
    searching,
    setCategoryId,
    setKind,
    setQuery,
    scope,
  };
}
