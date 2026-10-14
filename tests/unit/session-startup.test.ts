import { beforeEach, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import type { SessionAccess } from "../../src/services/session";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as User | null },
  observe: vi.fn(),
  signOut: vi.fn(),
  validate: vi.fn(),
  restore: vi.fn(),
  cachedAccess: vi.fn(),
  bootstrap: vi.fn(),
  storeAccess: vi.fn(),
  resetQueries: vi.fn(),
  refreshTopics: vi.fn(),
}));

vi.mock("firebase/auth", () => ({ onAuthStateChanged: mocks.observe, signOut: mocks.signOut }));
vi.mock("@/lib/firebase", () => ({ auth: mocks.auth }));
vi.mock("@/lib/session-debug", () => ({ sessionDebug: vi.fn() }));
vi.mock("@/lib/push-session", () => ({ setPushSession: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/avatar-cache", () => ({ readCachedAvatar: vi.fn(), writeCachedAvatar: vi.fn() }));
vi.mock("@/lib/composer-draft", () => ({ clearComposerDrafts: vi.fn() }));
vi.mock("@/lib/query-client", () => ({
  openQueryScope: vi.fn().mockResolvedValue(undefined), closeQueryScope: vi.fn(), resetAccessDependentQueries: mocks.resetQueries,
}));
vi.mock("@/services/backend-auth", () => ({ ensureBackendProfile: vi.fn() }));
vi.mock("@/services/session", () => ({
  fetchSessionAccess: vi.fn(),
  fetchSessionBootstrap: mocks.bootstrap,
  readCachedSessionAccess: mocks.cachedAccess,
  readSessionBootstrapSnapshot: vi.fn().mockReturnValue(null),
  storeSessionAccess: mocks.storeAccess,
}));
vi.mock("@/services/runtime-settings", () => ({ seedRuntimeSettings: vi.fn() }));
vi.mock("@/services/content-versions", () => ({
  applyContentVersionsSnapshot: vi.fn(), ensureContentVersionsFresh: vi.fn(),
}));
vi.mock("@/services/realtime-events", () => ({ refreshContentRealtimeTopics: mocks.refreshTopics, stopContentRealtimeSession: vi.fn() }));
vi.mock("@/services/uploads", () => ({ clearResolvedUploadCache: vi.fn() }));
vi.mock("@/services/users-write", () => ({ cacheUserAvatar: vi.fn() }));
vi.mock("@/services/notifications", () => ({ seedNotificationUnreadHint: vi.fn() }));
vi.mock("@/hooks/use-categories", () => ({ clearCategoryCatalog: vi.fn(), seedCategoryCatalog: vi.fn() }));
vi.mock("@/services/session-auth", () => ({ consumePreparedLoginEntrance: () => false, verifyRestoredSession: mocks.restore }));
vi.mock("@/services/session-validation", () => ({ validateBasicUser: () => ({ ok: true }), validateUserAgainstToken: mocks.validate }));

const access: SessionAccess = {
  role: "user", roles: [], permissions: [], managedFacilityCategoryIds: [], managedIssueCategoryIds: [], setupCompleted: true,
};
const user = { uid: "startup-user", photoURL: null } as User;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.auth.currentUser = user;
  mocks.signOut.mockResolvedValue(undefined);
  mocks.restore.mockResolvedValue("");
  mocks.validate.mockResolvedValue({ ok: true });
  mocks.cachedAccess.mockReturnValue(null);
  mocks.storeAccess.mockReturnValue(false);
  localStorage.clear();
});

async function start() {
  const store = await import("../../src/hooks/session-store");
  await store.initializeSession();
  await mocks.observe.mock.calls[0][1](user);
  return store;
}

it("opens after access arrives while the rest of bootstrap is still pending", async () => {
  let finish!: (value: unknown) => void;
  mocks.bootstrap.mockImplementation(async ({ onAccess }) => {
    onAccess(access);
    return await new Promise((resolve) => { finish = resolve; });
  });
  const store = await start();
  await vi.waitFor(() => expect(mocks.bootstrap).toHaveBeenCalledOnce());
  expect(store.getSessionState()).toMatchObject({ roleLoading: false, setupCompleted: true, startupPhase: "ready" });
  expect(mocks.bootstrap.mock.calls[0][0].force).not.toBe(true);
  expect(mocks.bootstrap.mock.calls[0][0].refresh).toBe(true);
  finish({ access, catalog: {}, versions: {}, notificationUnread: { hasUnread: false }, visitRecorded: false });
});

it("uses cached access only after security and token validation pass", async () => {
  let verify!: (value: { ok: boolean }) => void;
  mocks.validate.mockImplementation(() => new Promise((resolve) => { verify = resolve; }));
  mocks.cachedAccess.mockReturnValue(access);
  mocks.bootstrap.mockResolvedValue({ access, catalog: {}, versions: {}, notificationUnread: { hasUnread: false }, visitRecorded: false });
  const store = await start();
  expect(store.getSessionState().roleLoading).toBe(true);
  expect(mocks.bootstrap).not.toHaveBeenCalled();
  verify({ ok: true });
  await vi.waitFor(() => expect(store.getSessionState().roleLoading).toBe(false));
  expect(store.getSessionState().setupCompleted).toBe(true);
});

it("keeps the shell when optional bootstrap content fails after access", async () => {
  mocks.bootstrap.mockImplementation(async ({ onAccess }) => {
    onAccess(access);
    throw new Error("catalog unavailable");
  });
  const store = await start();
  await vi.waitFor(() => expect(store.getSessionState().roleLoading).toBe(false));
  expect(store.getSessionState().startupError).toBe("");
});

it("does not hydrate a cached account when the restored security check fails", async () => {
  mocks.restore.mockResolvedValue("auth.securityCheckFailed");
  mocks.cachedAccess.mockReturnValue(access);
  const store = await start();
  expect(store.getSessionState()).toMatchObject({ user: null, error: "auth.securityCheckFailed" });
  expect(mocks.bootstrap).not.toHaveBeenCalled();
  expect(mocks.signOut).toHaveBeenCalledOnce();
});

it("revokes cached access if the background refresh finds an account restriction", async () => {
  mocks.cachedAccess.mockReturnValue(access);
  mocks.bootstrap.mockImplementation(async () => {
    const { ApiRequestError } = await import("../../src/lib/api-error");
    throw new ApiRequestError({ error: { code: "account-restricted", message: "Restricted account" } });
  });
  const store = await start();
  await vi.waitFor(() => expect(store.getSessionState().user).toBe(null));
  expect(mocks.signOut).toHaveBeenCalledOnce();
});

it("reads every access-dependent answer again when the server's access differs from what was stored", async () => {
  mocks.storeAccess.mockReturnValue(true);
  mocks.bootstrap.mockImplementation(async ({ onAccess }) => {
    onAccess(access);
    return { access, catalog: {}, versions: {}, notificationUnread: { hasUnread: false }, visitRecorded: false };
  });
  const store = await start();
  await vi.waitFor(() => expect(store.getSessionState().startupPhase).toBe("ready"));
  expect(mocks.storeAccess).toHaveBeenCalledOnce();
  expect(mocks.resetQueries).toHaveBeenCalledOnce();
  expect(mocks.refreshTopics).toHaveBeenCalledOnce();
});

it("keeps cached answers when the server confirms the stored access", async () => {
  mocks.cachedAccess.mockReturnValue(access);
  mocks.bootstrap.mockResolvedValue({ access, catalog: {}, versions: {}, notificationUnread: { hasUnread: false }, visitRecorded: false });
  const store = await start();
  await vi.waitFor(() => expect(mocks.storeAccess).toHaveBeenCalledOnce());
  expect(store.getSessionState().setupCompleted).toBe(true);
  expect(mocks.resetQueries).not.toHaveBeenCalled();
  expect(mocks.refreshTopics).not.toHaveBeenCalled();
});
