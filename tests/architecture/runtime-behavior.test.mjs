import assert from "node:assert/strict";
import test from "node:test";
import { read } from "./helpers.mjs";

test("session bootstrap validates domain, token, access, and content versions", async () => {
  const session = await read("src/hooks/use-session.tsx");
  const validation = await read("src/services/session-validation.ts");
  assert.match(session, /fetchSessionBootstrap/u);
  assert.match(session, /ensureSupabaseAuthenticatedRole/u);
  assert.match(session, /applyContentVersionsSnapshot/u);
  assert.match(validation, /email_verified|emailVerified/u);
  assert.match(validation, /allowedDomain/u);
});

test("Google login retains the Firebase credential boundary", async () => {
  const auth = await read("src/services/session-auth.ts");
  const identity = await read("src/lib/google-identity.ts");
  assert.match(auth, /GoogleAuthProvider\.credential/u);
  assert.match(auth, /signInWithCredential/u);
  assert.match(identity, /initTokenClient/u);
});

test("private notifications and realtime remain recipient scoped", async () => {
  const notifications = await read("src/services/notifications.ts");
  const realtime = await read("src/services/realtime-events.ts");
  assert.match(notifications, /userId|user_id|recipient/u);
  assert.match(realtime, /private/u);
  assert.match(realtime, /content:user:/u);
});

test("content versions and caches have one invalidation path", async () => {
  const versions = await read("src/services/content-versions.ts");
  const cache = await read("src/services/content-read-cache.ts");
  const realtime = await read("src/services/realtime-events.ts");
  assert.match(versions, /getContentVersions/u);
  assert.match(cache, /invalidate|clear/u);
  assert.match(realtime, /ensureContentVersionsFresh|invalidate/u);
});

test("app updates use bounded service-worker reload recovery", async () => {
  const gate = await read("src/components/app-update-gate.tsx");
  assert.match(gate, /serviceWorker/u);
  assert.match(gate, /version\.json/u);
  assert.match(gate, /sessionStorage/u);
  assert.match(gate, /VERSION_CHECK_TIMEOUT_MS = 2_000/u);
  assert.match(gate, /SERVICE_WORKER_PREPARE_TIMEOUT_MS = 2_000/u);
  assert.match(gate, /MAX_AUTO_RELOAD_ATTEMPTS = 2/u);
  assert.match(gate, /serviceWorker\.register\("\/sw\.js"[\s\S]*updateViaCache: "none"/u);
  assert.match(gate, /registration\.waiting\?\.postMessage\(\{ type: "SKIP_WAITING" \}\)/u);
  assert.match(gate, /pageshow/u);
  assert.match(gate, /visibilitychange/u);
  assert.match(gate, /RELOAD_RECOVERY_TIMEOUT_MS = 10_000/u);
  assert.match(gate, /location\.(?:reload|replace)/u);
});

test("timestamps render in the device locale without mutating stored UTC values", async () => {
  const format = await read("src/lib/format.ts");
  assert.match(format, /Intl\.DateTimeFormat|toLocaleString/u);
  assert.doesNotMatch(format, /Asia\/Taipei/u);
});
