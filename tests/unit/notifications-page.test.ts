import { act, createElement } from "react";
import { queryClient, withQueryClient } from "./support/query-client";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useNotificationsPage } from "@/hooks/use-notifications-page";
import {
  fetchNotificationSnapshot,
  fetchNotificationSourcePages,
  markNotificationsOpened,
  type NotificationPage,
} from "@/services/notifications";
import type { NotificationRecord, NotificationSource } from "@/types";

const context = vi.hoisted(() => ({
  session: { user: { uid: "member" }, isAdmin: false },
  t: (key: string) => key,
}));
vi.mock("@/hooks/use-session", () => ({ useSession: () => context.session }));
vi.mock("@/i18n", () => ({ useI18n: () => ({ t: context.t }) }));
vi.mock("@/services/notifications", () => ({
  notificationKeys: { list: (sources: string[]) => ["notifications", "list", sources.join(",")] },
  fetchNotificationSnapshot: vi.fn(),
  fetchNotificationSourcePages: vi.fn(),
  markNotificationsOpened: vi.fn(async () => undefined),
  subscribeNotificationSource: vi.fn(() => () => undefined),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

let state: ReturnType<typeof useNotificationsPage>;
let root: Root;
let mounted = false;

function page(id: string, hasMore = true): NotificationPage {
  return {
    cursor: { id, createdAt: "2026-09-26T10:00:00.000Z" },
    hasMore,
    notifications: [{ id, source: "user", createdAt: new Date().toISOString() } as NotificationRecord],
  };
}

const READ_STATE = { adminOpenedAt: null, announcementOpenedAt: null, broadcastOpenedAt: null, userOpenedAt: null };

function snapshot(id: string) {
  return {
    admin: { cursor: null, hasMore: false, notifications: [] },
    broadcast: { cursor: null, hasMore: false, notifications: [] },
    user: page(id),
  } satisfies Record<NotificationSource, NotificationPage>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function pendingSnapshot() {
  const work = deferred<Awaited<ReturnType<typeof fetchNotificationSnapshot>>>();
  vi.mocked(fetchNotificationSnapshot).mockImplementationOnce(async (_sources, options) => {
    const result = await work.promise;
    options?.onPages?.(result.pages);
    return result;
  });
  return {
    ...work,
    complete: (id: string) => work.resolve({
      openedAt: "2026-09-26T10:00:00.000Z", pages: snapshot(id), state: READ_STATE,
    }),
  };
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(fetchNotificationSnapshot).mockImplementation(async (_sources, options) => {
    const pages = snapshot("first");
    options?.onPages?.(pages);
    return { openedAt: "2026-09-26T10:00:00.000Z", pages, state: READ_STATE };
  });
  root = createRoot(document.createElement("div"));
  function Probe() { state = useNotificationsPage(); return null; }
  await act(async () => root.render(withQueryClient(createElement(Probe))));
  mounted = true;
});

afterEach(async () => {
  if (mounted) await act(async () => root.unmount());
  queryClient.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("ignores a superseded page and prevents duplicate pagination requests", async () => {
  const oldPage = deferred<Awaited<ReturnType<typeof fetchNotificationSourcePages>>>();
  vi.mocked(fetchNotificationSourcePages).mockReturnValueOnce(oldPage.promise);
  let pagination!: Promise<void>;
  await act(async () => { pagination = state.loadMore(); void state.loadMore(); });
  expect(fetchNotificationSourcePages).toHaveBeenCalledTimes(1);
  await act(async () => state.load());
  await act(async () => { oldPage.resolve({ user: page("stale") }); await pagination; });
  expect(state.notifications.map(({ id }) => id)).toEqual(["first"]);
  expect(state.loadingMore).toBe(false);
});

it("keeps the newer refresh result when older snapshots finish late", async () => {
  const old = pendingSnapshot();
  let previous!: Promise<void>;
  await act(async () => { previous = state.load(); });
  const fresh = pendingSnapshot();
  let current!: Promise<void>;
  await act(async () => { current = state.load(); });
  await act(async () => { fresh.complete("fresh"); await current; });
  await act(async () => { old.complete("stale"); await previous; });
  expect(state.notifications.map(({ id }) => id)).toEqual(["fresh"]);
  expect(markNotificationsOpened).toHaveBeenCalledTimes(2);
});

it("does not clear the latest busy state or show an obsolete pagination failure", async () => {
  const oldPage = deferred<Awaited<ReturnType<typeof fetchNotificationSourcePages>>>();
  vi.mocked(fetchNotificationSourcePages).mockReturnValueOnce(oldPage.promise);
  let pagination!: Promise<void>;
  await act(async () => { pagination = state.loadMore(); });
  const fresh = pendingSnapshot();
  let refresh!: Promise<void>;
  await act(async () => { refresh = state.load(); });
  await act(async () => { oldPage.reject(new Error("old offline request")); });
  expect(state.loading).toBe(false);
  // A superseded page settles with the refresh that replaced it.
  await act(async () => { fresh.complete("fresh"); await refresh; await pagination; });
  expect(toast.error).not.toHaveBeenCalled();
  expect(state.loadingMore).toBe(false);
  expect(state.notifications.map(({ id }) => id)).toEqual(["fresh"]);
  expect(state.error).toBe("");
});

it("keeps existing notifications on refresh failure and recovers on retry", async () => {
  vi.mocked(fetchNotificationSnapshot).mockRejectedValueOnce(new Error("offline"));
  await act(async () => state.load());
  expect(state.error).toBe("offline");
  expect(state.notifications.map(({ id }) => id)).toEqual(["first"]);
  await act(async () => state.load());
  expect(state.error).toBe("");
  expect(state.loading).toBe(false);
});

it("stops offering more pages when the server repeats its cursor", async () => {
  vi.mocked(fetchNotificationSourcePages).mockResolvedValueOnce({ user: page("first") });
  await act(async () => state.loadMore());
  expect(state.hasMore).toBe(false);
  expect(state.notifications).toHaveLength(1);
});

it("does not mark notifications read after leaving the page", async () => {
  const work = pendingSnapshot();
  let refresh!: Promise<void>;
  await act(async () => { refresh = state.load(); });
  await act(async () => root.unmount());
  mounted = false;
  await act(async () => { work.complete("late"); await refresh; });
  expect(markNotificationsOpened).toHaveBeenCalledTimes(1);
});
