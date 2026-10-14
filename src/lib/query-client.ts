import { dehydrate, hydrate, QueryClient, type QueryKey } from '@tanstack/react-query';
import { removeLocalStorage } from './browser-storage';
import { getOperationPolicy } from './operation-policies';

/**
 * Every answer the app has read lives here, and nowhere else. What keeps it
 * right is not a clock: a content version or realtime event invalidates the
 * domain it changed, and a screen revisited after `viewMemoryMinutes` reads its
 * data again. A query is never retried on its own; the screen offers a retry.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // What no screen has shown for a day leaves memory. Timers cap near 24.8 days,
      // and a longer time would fire at once.
      gcTime: 24 * 60 * 60 * 1_000,
      retry: false,
      staleTime: () => getOperationPolicy('viewMemoryMinutes') * 60_000,
      // Only an invalidated or aged query is stale, so these refetch nothing else.
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
  },
});

/** The domains a content version or realtime event can invalidate. */
export type ContentDomain = 'announcements' | 'facilities' | 'issues';

/**
 * Marks everything under `queryKey` stale. A screen showing it reads again now
 * if the tab is visible, or when it next becomes visible.
 */
export function invalidate(queryKey: QueryKey) {
  return queryClient.invalidateQueries({
    queryKey,
    refetchType: typeof document === 'undefined' || document.visibilityState === 'visible' ? 'active' : 'none',
  });
}

// A list that had loaded more pages starts over from its first, as a screen
// opened fresh would, instead of reading every page it had again.
function keepFirstPages(domain: ContentDomain | 'notifications') {
  queryClient.setQueriesData({ queryKey: [domain, 'list'] }, (data: unknown) => {
    const paged = data as { pages?: unknown[]; pageParams?: unknown[] } | undefined;
    if (!paged?.pages || paged.pages.length <= 1) return data;
    return { pages: paged.pages.slice(0, 1), pageParams: paged.pageParams?.slice(0, 1) ?? [] };
  });
}

/** Marks a domain's lists stale. */
export function invalidateLists(domain: ContentDomain | 'notifications') {
  keepFirstPages(domain);
  return invalidate([domain, 'list']);
}

/** Marks everything a domain's content version covers stale. */
export function invalidateDomain(domain: ContentDomain) {
  keepFirstPages(domain);
  return invalidate([domain]);
}

/**
 * Shows what a write answered at once, under the key its screen reads, and
 * marks it stale so that screen still reads the record the way it is served.
 */
export function seedQuery(queryKey: QueryKey, data: unknown) {
  queryClient.setQueryData(queryKey, data);
  void queryClient.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
}

/** A cached answer younger than `maxAgeMs`, or a new one; concurrent callers share a request. */
export function readQuery<T>(queryKey: QueryKey, read: (context: { signal: AbortSignal }) => Promise<T>, maxAgeMs = Infinity) {
  return queryClient.fetchQuery({ queryKey, queryFn: read, staleTime: maxAgeMs });
}

type Entity = { id: string };

function mapEntities(value: unknown, update: (entity: Entity) => Entity | null): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const next: unknown[] = [];
    for (const item of value) {
      const mapped = mapEntities(item, update);
      if (mapped !== item) changed = true;
      if (mapped !== null) next.push(mapped);
    }
    return changed ? next : value;
  }
  if (!value || typeof value !== 'object') return value;
  if (typeof (value as Partial<Entity>).id === 'string') {
    const updated = update(value as Entity);
    if (updated !== value) return updated;
  }
  let next: Record<string, unknown> | null = null;
  for (const [key, field] of Object.entries(value)) {
    if (!field || typeof field !== 'object') continue;
    const mapped = mapEntities(field, update);
    if (mapped !== field) (next ??= { ...value })[key] = mapped;
  }
  return next ?? value;
}

/** Changes one record wherever a cached list or detail of its domain holds it. */
export function patchEntity<T extends Entity>(domain: ContentDomain, id: string, patch: Partial<T>) {
  queryClient.setQueriesData({ queryKey: [domain] }, (data: unknown) =>
    mapEntities(data, (entity) => entity.id === id ? { ...entity, ...patch } : entity));
}

/** Takes one record out of every cached list of its domain. */
export function dropEntity(domain: ContentDomain, id: string) {
  queryClient.setQueriesData({ queryKey: [domain, 'list'] }, (data: unknown) =>
    mapEntities(data, (entity) => entity.id === id ? null : entity));
}

/* ------------------------------------------------------------------ */
/* Persistence: one IndexedDB record per account.                       */
/* ------------------------------------------------------------------ */

const DATABASE = 'novae-queries';
const STORE = 'clients';
// Raised whenever a stored answer's shape changes; an older record is discarded.
const BUSTER = '1';
// A saved answer older than this is not restored.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const SAVE_DELAY_MS = 1_000;
const RETIRED_DATABASES = ['novae-content-cache-v5', 'novae-content-cache-v4'];

interface StoredClient {
  buster: string;
  state: ReturnType<typeof dehydrate>;
}

let database: Promise<IDBDatabase> | null = null;

function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => {
      const db = request.result;
      // Another page deleting or upgrading the database waits on every open
      // connection, and an open queued behind it waits too: let go at once and
      // reopen on the next read or save.
      db.onversionchange = () => {
        db.close();
        database = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      database = null;
      reject(request.error ?? new Error('IndexedDB could not be opened.'));
    };
  });
  return database;
}

async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  return await new Promise<T>((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

interface Scope {
  uid: string;
  stop: () => void;
}

let scope: Scope | null = null;
let retired = false;

function retireOldStorage(uid: string) {
  // Content versions now live in the cache record, beside the answers they describe.
  removeLocalStorage(`novae:content-versions:${uid}`);
  if (retired) return;
  retired = true;
  for (const name of RETIRED_DATABASES) indexedDB.deleteDatabase(name);
}

/**
 * Opens the cache for one account: what it saved last time is restored before
 * the first screen reads, and every change after that is saved again. A
 * restore that finishes after the account changed is thrown away.
 */
export async function openQueryScope(uid: string) {
  if (scope?.uid === uid) return;
  closeQueryScope();
  if (typeof indexedDB === 'undefined') return;
  retireOldStorage(uid);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe = () => {};
  // A tab being hidden or closed saves what is waiting rather than losing its last second.
  const flush = () => {
    if (!timer) return;
    clearTimeout(timer);
    save();
  };
  const flushWhenHidden = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  const current: Scope = {
    uid,
    stop: () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', flushWhenHidden);
      window.removeEventListener('pagehide', flush);
    },
  };
  scope = current;
  // Without the saved record the account starts cold, which is slower but still right.
  const stored = await transact<StoredClient | undefined>('readonly', (store) => store.get(uid)).catch((error: unknown) => {
    console.warn('The saved query cache could not be read.', error);
    return undefined;
  });
  if (scope !== current) return;
  if (stored?.buster === BUSTER) {
    const now = Date.now();
    hydrate(queryClient, {
      ...stored.state,
      queries: stored.state.queries.filter((query) => now - query.state.dataUpdatedAt < MAX_AGE_MS),
    });
  }
  function save() {
    timer = null;
    const record: StoredClient = {
      buster: BUSTER,
      state: dehydrate(queryClient, {
        // A query marked `meta: { persist: false }` holds what must not reach the disk.
        shouldDehydrateQuery: (query) => query.state.status === 'success' && query.meta?.persist !== false,
      }),
    };
    void transact('readwrite', (store) => store.put(record, uid)).catch((error: unknown) => {
      console.warn('The query cache could not be saved.', error);
    });
  }
  unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'added' && event.type !== 'removed' && event.type !== 'updated') return;
    timer ??= setTimeout(save, SAVE_DELAY_MS);
  });
  document.addEventListener('visibilitychange', flushWhenHidden);
  window.addEventListener('pagehide', flush);
}

/** Stops saving the open account's cache and empties memory; `forget` also deletes what was saved. */
export function closeQueryScope(options: { forget?: boolean } = {}) {
  const closing = scope;
  scope = null;
  closing?.stop();
  queryClient.clear();
  if (closing && options.forget) {
    void transact('readwrite', (store) => store.delete(closing.uid)).catch((error: unknown) => {
      console.warn('The saved query cache could not be deleted.', error);
    });
  }
}
