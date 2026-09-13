"use client";
import { useCallback, useEffect, useState } from 'react';
import { fetchOperationsConsole, saveOperationPolicies, retryOperationalWork, type OperationsConsole } from '@/services/operations-console';
import { setOperationPolicies } from '@/lib/operation-policies';
import type { OperationPolicies } from '@/generated/operations';

export function useOperationsConsole() {
  const [data, setData] = useState<OperationsConsole | null>(null);
  const [draft, setDraft] = useState<OperationPolicies | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [page,setPage] = useState(0);
  const load = useCallback(async (nextPage = 0, preserveDraft = false) => {
    setBusy(true);
    setError('');
    try {
      const snapshot = await fetchOperationsConsole({ page: nextPage });
      setPage(nextPage);
      setData(current => preserveDraft && current ? { ...snapshot, settings: current.settings } : snapshot);
      if (!preserveDraft) setDraft(snapshot.settings.values);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save() {
    if (!data || !draft || busy) return;
    setBusy(true);
    setError('');
    try {
      const saved = await saveOperationPolicies({ revision: data.settings.revision, values: draft, reason });
      setOperationPolicies(saved.values);
      setReason('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally { setBusy(false); }
  }
  async function retry(kind: 'job' | 'delivery' | 'cleanup', id: string) {
    setBusy(true);
    try { await retryOperationalWork({ kind, id }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  }
  return { data, draft, reason, setReason, error, busy, load, save, retry,
    page, changePage: (next: number) => load(next,true),
    update: (key: keyof OperationPolicies, value: number) => setDraft(current => current ? { ...current, [key]: value } : current) };
}
