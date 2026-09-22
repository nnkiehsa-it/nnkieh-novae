const CACHE_NAME = "novae-push-session-v1";
const SESSION_PATH = "/__novae/push-session";
let pendingWrite = Promise.resolve();

/** Shared with the service worker, so logout also silences background notifications. */
export function setPushSession(uid: string | null): Promise<void> {
  pendingWrite = pendingWrite.catch(() => undefined).then(async () => {
    if (typeof caches === "undefined") return;
    if (!uid) { await caches.delete(CACHE_NAME); return; }
    const cache = await caches.open(CACHE_NAME);
    await cache.put(new URL(SESSION_PATH, globalThis.location.origin).href, Response.json({ uid }));
  });
  return pendingWrite;
}

export async function canDisplayPushFor(uid: unknown): Promise<boolean> {
  if (typeof uid !== "string" || !uid || typeof caches === "undefined") return false;
  try {
    const response = await caches.match(new URL(SESSION_PATH, globalThis.location.origin).href, { cacheName: CACHE_NAME });
    return response ? (await response.json() as { uid?: unknown }).uid === uid : false;
  } catch {
    return false;
  }
}
