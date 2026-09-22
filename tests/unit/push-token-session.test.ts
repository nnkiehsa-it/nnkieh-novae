import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: { currentUser: { uid: "a" } }, getToken: vi.fn(), register: vi.fn(), unregister: vi.fn(), setSession: vi.fn() }));
vi.mock("client-only", () => ({}));
vi.mock("@/lib/firebase", () => ({ auth: mocks.auth, firebaseVapidKey: "test-key" }));
vi.mock("@/lib/firebase-app-check", () => ({ ensureFirebaseAppCheck: async () => {} }));
vi.mock("@/lib/firebase-messaging", () => ({ loadFirebaseMessaging: async () => ({ sdk: { getToken: mocks.getToken }, messaging: {} }) }));
vi.mock("@/lib/push-session", () => ({ setPushSession: mocks.setSession }));
vi.mock("@/services/push-notifications", () => ({ registerPushToken: mocks.register, unregisterPushToken: mocks.unregister }));
import { confirmCurrentPushToken, revokeCurrentDevicePush } from "@/services/push-token-registration";

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); localStorage.clear(); });
it("does not register a token whose account changed while Firebase was resolving it", async () => {
  mocks.auth.currentUser = { uid: "a" };
  vi.stubGlobal("Notification", { permission: "granted" });
  vi.stubGlobal("navigator", { serviceWorker: { ready: Promise.resolve({}) }, platform: "test", userAgent: "test" });
  let finish!: (token: string) => void;
  mocks.getToken.mockImplementationOnce(() => new Promise<string>((resolve) => { finish = resolve; }));
  const pending = confirmCurrentPushToken("a", true);
  await vi.waitFor(() => expect(mocks.getToken).toHaveBeenCalledOnce());
  mocks.auth.currentUser = { uid: "b" };
  finish("token-a");
  expect(await pending).toBeNull();
  expect(mocks.register).not.toHaveBeenCalled();
  expect(mocks.setSession).not.toHaveBeenCalled();
});

it("mutes push and forgets confirmation even if server revocation fails", async () => {
  localStorage.setItem("novae:push-device-id", "device");
  localStorage.setItem("novae:push-confirmed-uid", "a");
  mocks.setSession.mockResolvedValue(undefined);
  mocks.unregister.mockRejectedValueOnce(new Error("offline"));
  await expect(revokeCurrentDevicePush()).rejects.toThrow("offline");
  expect(mocks.setSession).toHaveBeenCalledWith(null);
  expect(mocks.unregister).toHaveBeenCalledWith("device");
  expect(localStorage.getItem("novae:push-confirmed-uid")).toBe("");
});
