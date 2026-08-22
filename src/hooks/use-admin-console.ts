"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

import {
  fetchAdminOverview,
  listAdminAudit,
  listAdminUsers,
  setUserRestriction,
  type AdminAuditEntry,
  type AdminOverviewData,
  type AdminOverviewWindow,
  type AdminUser,
  type RestrictionMode,
} from "@/services/admin-console";
import { fetchPlatformDashboard } from "@/services/dashboard";

export type {
  AdminAuditEntry,
  AdminOverviewData,
  AdminOverviewWindow,
  AdminUser,
  RestrictionMode,
} from "@/services/admin-console";

export function useAdminOverview(window: AdminOverviewWindow) {
  const { t } = useI18n();
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [systemFailures, setSystemFailures] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overview, dashboard] = await Promise.all([
        fetchAdminOverview(window),
        fetchPlatformDashboard({ forceRefresh: true }),
      ]);
      setData(overview);
      setSystemFailures(
        dashboard.operations.failed_outbox_count
          + dashboard.operations.failed_push_delivery_count
          + dashboard.operations.cleanup_backlog_count
          + dashboard.operations.stuck_upload_count,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("ui.adminConsole.loadOverviewFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, window]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, load, loading, systemFailures };
}

export function useAdminUsers() {
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (value: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await listAdminUsers(value);
      setUsers(result.users);
      setSelected((current) => current
        ? result.users.find((user) => user.uid === current.uid) ?? null
        : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("ui.adminConsole.loadUsersFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load("");
  }, [load]);

  const updateRestriction = useCallback(async (user: AdminUser, mode: RestrictionMode) => {
    if (mode !== "clear" && !reason.trim()) {
      toast.error(t("ui.adminConsole.reasonRequired"));
      return;
    }
    setBusy(user.uid);
    try {
      await setUserRestriction(user.uid, mode, mode === "clear" ? "" : reason);
      toast.success(mode === "clear"
        ? t("ui.adminConsole.restrictionCleared")
        : t("ui.adminConsole.restrictionSet"));
      setReason("");
      await load(query);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
    } finally {
      setBusy("");
    }
  }, [load, query, reason, t]);

  return {
    busy,
    error,
    load,
    loading,
    query,
    reason,
    selected,
    setQuery,
    setReason,
    setSelected,
    updateRestriction,
    users,
  };
}

export function useAdminAudit() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (value: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await listAdminAudit(value);
      setEntries(result.entries);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("ui.adminConsole.loadAuditFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load("");
  }, [load]);

  return { entries, error, load, loading, query, setQuery };
}
