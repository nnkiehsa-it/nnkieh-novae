"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

import { useRememberedState } from "@/hooks/use-remembered-state";
import { useAdminReading } from "@/hooks/use-admin-reading";
import { useAdminMutation } from "@/hooks/use-admin-mutation";
import {
  listAdminAudit,
  listAdminActivity,
  listAdminUsers,
  listAccountAccessRules,
  saveAccountAccessRule,
  deleteAccountAccessRule,
  type AdminAuditEntry,
  type AdminActivityCursor,
  type AdminOverviewData,
  type AdminOverviewWindow,
  type AdminUser,
  type AccountAccessRule,
  type AccountAccessRuleInput,
} from "@/services/admin-console";

export type {
  AdminAuditEntry,
  AdminOverviewData,
  AdminOverviewWindow,
  AdminUser,
  AccountAccessDuration,
  AccountAccessPreset,
  AccountAccessRule,
  AccountAccessRuleInput,
  AccountAccessTargetType,
} from "@/services/admin-console";

export type AccountAccessMutation = Awaited<ReturnType<typeof saveAccountAccessRule>>;

interface PagedReading<T> {
  activeQuery: string;
  hasMore: boolean;
  page: number;
  rows: T[];
}

/**
 * A searched, paged administrative record list.
 *
 * Users and the audit log are the same reading over two tables, and they are
 * remembered the same way: the page that was last read stays on screen, and the
 * backend refreshes it when the view opens, searches, pages, or refreshes.
 */
function usePagedAdminList<T>(
  key: string,
  fetchPage: (query: string, page: number) => Promise<{ hasMore: boolean; rows: T[] }>,
  failureKey: string,
) {
  const { remember, value } = useRememberedState<PagedReading<T>>(key, {
    activeQuery: "",
    hasMore: false,
    page: 0,
    rows: [],
  });
  const [query, setQuery] = useState(value.activeQuery);
  const { error, invalidate, isActive, loading, read } = useAdminReading(key, failureKey);
  const current = useRef(value);
  useEffect(() => { current.current = value; }, [value]);

  const load = useCallback(
    (nextQuery: string, nextPage = 0) => read(
      () => fetchPage(nextQuery, nextPage),
      (result) => {
        remember({
          activeQuery: nextQuery,
          hasMore: result.hasMore,
          page: nextPage,
          rows: result.rows,
        });
      },
    ),
    [fetchPage, read, remember],
  );
  const loadCurrent = useRef(load);
  useEffect(() => { loadCurrent.current = load; }, [load]);

  useEffect(() => {
    setQuery(current.current.activeQuery);
    void loadCurrent.current(current.current.activeQuery, current.current.page);
  }, [isActive]);

  const updateRows = useCallback((update: (rows: T[]) => T[]) => {
    remember((previous) => ({ ...previous, rows: update(previous.rows) }));
  }, [remember]);

  return {
    changePage: (next: number) => load(value.activeQuery, next),
    error,
    hasMore: value.hasMore,
    invalidate,
    isActive,
    load,
    loading,
    page: value.page,
    query,
    resetSearch: () => { setQuery(""); return load(""); },
    rows: value.rows,
    refresh: () => load(value.activeQuery, value.page),
    setQuery,
    updateRows,
  };
}

async function fetchUserPage(query: string, page: number) {
  const result = await listAdminUsers(query, page);
  return { hasMore: result.truncated, rows: result.users };
}

async function fetchAuditPage(query: string, page: number) {
  const result = await listAdminAudit(query, page);
  return { hasMore: result.truncated, rows: result.entries };
}

export function useAdminActivity(window: AdminOverviewWindow) {
  const { cold, remember, value } = useRememberedState<{
    cursor: AdminActivityCursor | null;
    entries: AdminOverviewData["recentActivity"];
  }>(`admin-activity:${window}`, { cursor: null, entries: [] });
  const { error, loading, read } = useAdminReading(`admin-activity:${window}`, "ui.adminConsole.loadActivityFailed");

  const load = useCallback(
    (nextCursor: AdminActivityCursor | null = null) => read(
      () => listAdminActivity(window, nextCursor),
      (result) => {
        remember((current) => ({
          cursor: result.nextCursor,
          entries: nextCursor ? [...current.entries, ...result.entries] : result.entries,
        }));
      },
    ),
    [read, remember, window],
  );

  useEffect(() => {
    if (cold) void load();
  }, [cold, load]);

  return { cursor: value.cursor, entries: value.entries, error, load, loading };
}

export function useAdminUsers() {
  const { t } = useI18n();
  const list = usePagedAdminList<AdminUser>(
    "admin-users",
    fetchUserPage,
    "ui.adminConsole.loadUsersFailed",
  );
  const [selectedUid, setSelectedUid] = useState("");
  const mutation = useAdminMutation(list);
  const selected = list.rows.find((user) => user.uid === selectedUid) ?? null;

  const updateRestriction = useCallback(
    (user: AdminUser, input: AccountAccessRuleInput | null) => mutation.run(user.uid,
      () => input ? saveAccountAccessRule(input) : deleteAccountAccessRule("uid", user.uid, user.accessRuleRevision),
      (result) => {
        list.updateRows((rows) => rows.map((row) => row.uid === user.uid
          ? { ...row, accessRule: result.effectiveRule, accessRuleRevision: result.revision } : row));
        toast.success(t(input ? "ui.accountAccess.saved" : result.effectiveRule
          ? "ui.accountAccess.individualRemovedPrefixRemains" : "ui.adminConsole.restrictionCleared"));
      }),
    [list, mutation, t],
  );

  return {
    ...list,
    busy: mutation.busy,
    mutationError: mutation.error,
    refresh: () => { mutation.clearError(); return list.refresh(); },
    selected,
    setSelected: (user: AdminUser | null) => setSelectedUid(user?.uid ?? ""),
    updateRestriction,
    users: list.rows,
  };
}

export function useAccountAccessRules() {
  const { t } = useI18n();
  const { remember, value } = useRememberedState<AccountAccessRule[]>("account-access-rules", []);
  const reading = useAdminReading("account-access-rules", "ui.common.loadFailed");
  const { error, loading, read } = reading;
  const mutation = useAdminMutation(reading);
  const { clearError } = mutation;
  const load = useCallback(() => { clearError(); return read(listAccountAccessRules, remember); }, [clearError, read, remember]);
  useEffect(() => { void load(); }, [load]);
  const apply = useCallback((result: Awaited<ReturnType<typeof saveAccountAccessRule>>) => {
    remember((current) => {
      const rest = current.filter((rule) => rule.targetType !== result.targetType || rule.targetValue !== result.targetValue);
      return result.rule ? [...rest, result.rule].sort((a, b) => a.targetValue.localeCompare(b.targetValue)) : rest;
    });
  }, [remember]);
  const save = (input: AccountAccessRuleInput) => mutation.run(input.targetValue,
    () => saveAccountAccessRule(input), (result) => { apply(result); toast.success(t("ui.accountAccess.saved")); });
  const remove = async (rule: AccountAccessRule) => {
    try {
      return await mutation.run(rule.targetValue,
        () => deleteAccountAccessRule(rule.targetType, rule.targetValue, rule.revision),
        (result) => { apply(result); toast.success(t("ui.accountAccess.removed")); });
    } catch { return null; }
  };
  return { busy: mutation.busy, error, load, loading, mutationError: mutation.error, remove, rules: value, save };
}

export function useAdminAudit() {
  const list = usePagedAdminList<AdminAuditEntry>(
    "admin-audit",
    fetchAuditPage,
    "ui.adminConsole.loadAuditFailed",
  );
  return { ...list, entries: list.rows };
}
