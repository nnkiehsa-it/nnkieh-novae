"use client";
import { useState } from 'react';
import { getProviderDiagnostics, type ProviderDiagnostic } from '@/services/operations-console';

export function useProviderDiagnostics() {
  const [results, setResults] = useState<Record<string, ProviderDiagnostic>>({});
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [query,setQuery] = useState('');
  const [activeQuery,setActiveQuery] = useState('');
  async function load(provider: string, next = false) {
    setPending(provider); setError('');
    try {
      const result = await getProviderDiagnostics({ provider,
        ...(provider === 'logs' ? { query: next ? activeQuery : query } : {}),
        ...(next && results[provider]?.nextCursor ? { cursor: results[provider].nextCursor!, until: results[provider].until } : {}) });
      if (provider === 'logs' && !next) setActiveQuery(query);
      setResults(current => ({ ...current, [provider]: result }));
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setPending(''); }
  }
  return { results, pending, error, load, query,setQuery };
}
