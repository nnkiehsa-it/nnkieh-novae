"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

import { useRememberedState } from "@/hooks/use-remembered-state";
import { useAdminReading } from "@/hooks/use-admin-reading";
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
  type AccountAccessDuration,
  type AccountAccessPreset,
  type AccountAccessRule,
} from "@/services/admin-console";

export type {
  AdminAuditEntry,
  AdminOverviewData,
  AdminOverviewWindow,
  AdminUser,
  AccountAccessDuration,
  AccountAccessPreset,
  AccountAccessRule,
} from "@/services/admin-console";

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
 * backend is asked again only when the reader searches, pages, or refreshes.
 */
function usePagedAdminList<T>(
  key: string,
  fetchPage: (query: string, page: number) => Promise<{ hasMore: boolean; rows: T[] }>,
  failureKey: string,
) {
  const { cold, remember, value } = useRememberedState<PagedReading<T>>(key, {
    activeQuery: "",
    hasMore: false,
    page: 0,
    rows: [],
  });
  const [query, setQuery] = useState(value.activeQuery);
  const { error, loading, read } = useAdminReading(key, failureKey);

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

  useEffect(() => {
    if (cold) void load("");
  }, [cold, load]);

  return {
    changePage: (next: number) => load(value.activeQuery, next),
    error,
    hasMore: value.hasMore,
    load,
    loading,
    page: value.page,
    query,
    resetSearch: () => { setQuery(""); return load(""); },
    rows: value.rows,
    setQuery,
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
  const [busy, setBusy] = useState("");
  const selected = list.rows.find((user) => user.uid === selectedUid) ?? null;

  const updateRestriction = useCallback(
    async (user: AdminUser, input: {
      duration: AccountAccessDuration;
      durationHours?: number;
      message: string;
      preset: AccountAccessPreset;
    } | null) => {
      setBusy(user.uid);
      try {
        if (input) await saveAccountAccessRule({ ...input, targetType: "uid", targetValue: user.uid });
        else await deleteAccountAccessRule("uid", user.uid);
        toast.success(input === null
          ? t("ui.adminConsole.restrictionCleared")
          : t("ui.adminConsole.restrictionSet"));
        await list.changePage(list.page);
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
      } finally {
        setBusy("");
      }
    },
    [list, t],
  );

  return {
    ...list,
    busy,
    selected,
    setSelected: (user: AdminUser | null) => setSelectedUid(user?.uid ?? ""),
    updateRestriction,
    users: list.rows,
  };
}

export function useAccountAccessRules() {
  const { t } = useI18n();
  const { cold, remember, value } = useRememberedState<AccountAccessRule[]>("account-access-rules", []);
  const { error, loading, read } = useAdminReading("account-access-rules", "ui.common.loadFailed");
  const [busy, setBusy] = useState("");
  const load = useCallback(() => read(listAccountAccessRules, remember), [read, remember]);
  useEffect(() => { if (cold) void load(); }, [cold, load]);
  const save = useCallback(async (input: Parameters<typeof saveAccountAccessRule>[0]) => {
    setBusy(input.targetValue);
    try {
      await saveAccountAccessRule(input);
      toast.success(t("ui.adminConsole.restrictionSet"));
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
      throw caught;
    } finally {
      setBusy("");
    }
  }, [load, t]);
  const remove = useCallback(async (rule: AccountAccessRule) => {
    setBusy(rule.targetValue);
    try {
      await deleteAccountAccessRule(rule.targetType, rule.targetValue);
      toast.success(t("ui.adminConsole.restrictionCleared"));
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
    } finally {
      setBusy("");
    }
  }, [load, t]);
  return { busy, error, load, loading, remove, rules: value, save };
}

export function useAdminAudit() {
  const list = usePagedAdminList<AdminAuditEntry>(
    "admin-audit",
    fetchAuditPage,
    "ui.adminConsole.loadAuditFailed",
  );
  return { ...list, entries: list.rows };
}
