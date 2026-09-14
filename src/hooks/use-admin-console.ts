"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

import { useRememberedState } from "@/hooks/use-remembered-state";
import {
  listAdminAudit,
  listAdminActivity,
  listAdminUsers,
  setUserRestriction,
  type AdminAuditEntry,
  type AdminActivityCursor,
  type AdminOverviewData,
  type AdminOverviewWindow,
  type AdminUser,
  type RestrictionMode,
} from "@/services/admin-console";

export type {
  AdminAuditEntry,
  AdminOverviewData,
  AdminOverviewWindow,
  AdminUser,
  RestrictionMode,
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
  const { t } = useI18n();
  const { cold, remember, value } = useRememberedState<PagedReading<T>>(key, {
    activeQuery: "",
    hasMore: false,
    page: 0,
    rows: [],
  });
  const [query, setQuery] = useState(value.activeQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (nextQuery: string, nextPage = 0) => {
      setLoading(true);
      setError("");
      try {
        const result = await fetchPage(nextQuery, nextPage);
        remember({
          activeQuery: nextQuery,
          hasMore: result.hasMore,
          page: nextPage,
          rows: result.rows,
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t(failureKey));
      } finally {
        setLoading(false);
      }
    },
    [failureKey, fetchPage, remember, t],
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
  const { t } = useI18n();
  const { cold, remember, value } = useRememberedState<{
    cursor: AdminActivityCursor | null;
    entries: AdminOverviewData["recentActivity"];
  }>(`admin-activity:${window}`, { cursor: null, entries: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (nextCursor: AdminActivityCursor | null = null) => {
      setLoading(true);
      setError("");
      try {
        const result = await listAdminActivity(window, nextCursor);
        remember((current) => ({
          cursor: result.nextCursor,
          entries: nextCursor ? [...current.entries, ...result.entries] : result.entries,
        }));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t("ui.adminConsole.loadActivityFailed"));
      } finally {
        setLoading(false);
      }
    },
    [remember, t, window],
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
  const [reason, setReason] = useState("");
  const [durationHours, setDurationHours] = useState(24);
  const [busy, setBusy] = useState("");
  const selected = list.rows.find((user) => user.uid === selectedUid) ?? null;

  const updateRestriction = useCallback(
    async (user: AdminUser, mode: RestrictionMode) => {
      if (mode !== "clear" && !reason.trim()) {
        toast.error(t("ui.adminConsole.reasonRequired"));
        return;
      }
      setBusy(user.uid);
      try {
        await setUserRestriction(user.uid, mode, mode === "clear" ? "" : reason, durationHours);
        toast.success(mode === "clear"
          ? t("ui.adminConsole.restrictionCleared")
          : t("ui.adminConsole.restrictionSet"));
        setReason("");
        await list.load(list.query);
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
      } finally {
        setBusy("");
      }
    },
    [durationHours, list, reason, t],
  );

  return {
    ...list,
    busy,
    durationHours,
    reason,
    selected,
    setDurationHours,
    setReason,
    setSelected: (user: AdminUser | null) => setSelectedUid(user?.uid ?? ""),
    updateRestriction,
    users: list.rows,
  };
}

export function useAdminAudit() {
  const list = usePagedAdminList<AdminAuditEntry>(
    "admin-audit",
    fetchAuditPage,
    "ui.adminConsole.loadAuditFailed",
  );
  return { ...list, entries: list.rows };
}
