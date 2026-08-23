const DATABASE_NAME = 'novae-content-cache';
const DATABASE_VERSION = 3;
const ENTRY_STORE_NAME = 'entries';
const METADATA_STORE_NAME = 'metadata';
const BUDGET_KEY = 'budget';

export const PERSISTENT_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
export const PERSISTENT_CACHE_MAX_BYTES = 16 * 1024 * 1024;
export const PERSISTENT_CACHE_MAX_ENTRIES = 500;

export interface PersistentCacheEntry<T> {
  cacheKey: string;
  key: string;
  scope: string;
  sizeBytes: number;
  updatedAt: number;
  value: T;
  writeVersion?: number;
}

interface PersistentCacheBudget {
  entryCount: number;
  key: typeof BUDGET_KEY;
  totalBytes: number;
}

export function shouldPrunePersistentCacheEntry(input: {
  entryCount: number;
  now: number;
  oldestUpdatedAt: number;
  totalBytes: number;
}) {
  return input.now - input.oldestUpdatedAt >= PERSISTENT_CACHE_MAX_AGE_MS ||
    input.entryCount > PERSISTENT_CACHE_MAX_ENTRIES ||
    input.totalBytes > PERSISTENT_CACHE_MAX_BYTES;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function emptyBudget(): PersistentCacheBudget {
  return { entryCount: 0, key: BUDGET_KEY, totalBytes: 0 };
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const transaction = request.transaction;
      const entryStore = database.objectStoreNames.contains(ENTRY_STORE_NAME)
        ? transaction!.objectStore(ENTRY_STORE_NAME)
        : database.createObjectStore(ENTRY_STORE_NAME, { keyPath: 'key' });
      entryStore.clear();
      if (!entryStore.indexNames.contains('scope'))
        entryStore.createIndex('scope', 'scope', { unique: false });
      if (!entryStore.indexNames.contains('updatedAt'))
        entryStore.createIndex('updatedAt', 'updatedAt', { unique: false });

      const metadataStore = database.objectStoreNames.contains(METADATA_STORE_NAME)
        ? transaction!.objectStore(METADATA_STORE_NAME)
        : database.createObjectStore(METADATA_STORE_NAME, { keyPath: 'key' });
      metadataStore.clear();
      metadataStore.put(emptyBudget());
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function estimateEntryBytes(entry: Omit<PersistentCacheEntry<unknown>, 'sizeBytes'>) {
  return new TextEncoder().encode(JSON.stringify(entry)).byteLength;
}

function subtractEntry(budget: PersistentCacheBudget, entry: PersistentCacheEntry<unknown>) {
  budget.entryCount = Math.max(0, budget.entryCount - 1);
  budget.totalBytes = Math.max(0, budget.totalBytes - entry.sizeBytes);
}

async function prunePersistentCache(
  store: IDBObjectStore,
  budget: PersistentCacheBudget,
  now = Date.now(),
) {
  const request = store.index('updatedAt').openCursor();
  await new Promise<void>((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('IndexedDB cursor failed'));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const entry = cursor.value as PersistentCacheEntry<unknown>;
      if (!shouldPrunePersistentCacheEntry({
        entryCount: budget.entryCount,
        now,
        oldestUpdatedAt: entry.updatedAt,
        totalBytes: budget.totalBytes,
      })) {
        resolve();
        return;
      }
      cursor.delete();
      subtractEntry(budget, entry);
      cursor.continue();
    };
  });
}

async function readBudget(transaction: IDBTransaction) {
  const budget = await requestResult(
    transaction.objectStore(METADATA_STORE_NAME).get(BUDGET_KEY),
  ) as PersistentCacheBudget | undefined;
  return budget ?? emptyBudget();
}

export async function readPersistentCache<T>(key: string) {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(ENTRY_STORE_NAME, 'readonly');
    return await requestResult(transaction.objectStore(ENTRY_STORE_NAME).get(key)) as PersistentCacheEntry<T> | undefined;
  } catch {
    return undefined;
  }
}

export async function writePersistentCache<T>(entry: Omit<PersistentCacheEntry<T>, 'sizeBytes'>) {
  try {
    const normalizedEntry: PersistentCacheEntry<T> = {
      ...entry,
      sizeBytes: estimateEntryBytes(entry as Omit<PersistentCacheEntry<unknown>, 'sizeBytes'>),
    };
    const database = await openDatabase();
    const transaction = database.transaction(
      [ENTRY_STORE_NAME, METADATA_STORE_NAME],
      'readwrite',
    );
    const store = transaction.objectStore(ENTRY_STORE_NAME);
    const previous = await requestResult(store.get(entry.key)) as PersistentCacheEntry<unknown> | undefined;
    const budget = await readBudget(transaction);
    if (previous) budget.totalBytes = Math.max(0, budget.totalBytes - previous.sizeBytes);
    else budget.entryCount += 1;
    budget.totalBytes += normalizedEntry.sizeBytes;
    store.put(normalizedEntry);
    await prunePersistentCache(store, budget);
    transaction.objectStore(METADATA_STORE_NAME).put(budget);
    await transactionDone(transaction);
  } catch {
    // Persistent caching is optional; memory caching remains available.
  }
}

export async function deletePersistentCacheIfVersion(key: string, writeVersion: number) {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(
      [ENTRY_STORE_NAME, METADATA_STORE_NAME],
      'readwrite',
    );
    const store = transaction.objectStore(ENTRY_STORE_NAME);
    const entry = await requestResult(store.get(key)) as PersistentCacheEntry<unknown> | undefined;
    if (entry?.writeVersion === writeVersion) {
      store.delete(key);
      const budget = await readBudget(transaction);
      subtractEntry(budget, entry);
      transaction.objectStore(METADATA_STORE_NAME).put(budget);
    }
    await transactionDone(transaction);
  } catch {
    // Ignore unavailable or blocked storage.
  }
}

export async function deletePersistentCacheByPrefix(scope: string, prefix: string) {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(
      [ENTRY_STORE_NAME, METADATA_STORE_NAME],
      'readwrite',
    );
    const store = transaction.objectStore(ENTRY_STORE_NAME);
    const budget = await readBudget(transaction);
    const request = store.index('scope').openCursor(IDBKeyRange.only(scope));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        transaction.objectStore(METADATA_STORE_NAME).put(budget);
        return;
      }
      const entry = cursor.value as PersistentCacheEntry<unknown>;
      if (entry.cacheKey.startsWith(prefix)) {
        cursor.delete();
        subtractEntry(budget, entry);
      }
      cursor.continue();
    };
    await transactionDone(transaction);
  } catch {
    // Ignore unavailable or blocked storage.
  }
}

export async function clearPersistentCacheScope(scope: string) {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(
      [ENTRY_STORE_NAME, METADATA_STORE_NAME],
      'readwrite',
    );
    const store = transaction.objectStore(ENTRY_STORE_NAME);
    const budget = await readBudget(transaction);
    const request = store.index('scope').openCursor(IDBKeyRange.only(scope));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        transaction.objectStore(METADATA_STORE_NAME).put(budget);
        return;
      }
      const entry = cursor.value as PersistentCacheEntry<unknown>;
      cursor.delete();
      subtractEntry(budget, entry);
      cursor.continue();
    };
    await transactionDone(transaction);
  } catch {
    // Ignore unavailable or blocked storage.
  }
}
