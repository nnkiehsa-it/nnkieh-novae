import { afterEach, expect, it, vi } from "vitest";
import { canDisplayPushFor, setPushSession } from "@/lib/push-session";
import { sameOriginUrl } from "@/lib/same-origin-url";

afterEach(() => { vi.unstubAllGlobals(); });
it("background push is limited to the active account and stays muted after logout", async () => {
  const entries = new Map<string, Response>();
  vi.stubGlobal("caches", {
    open: async () => ({ put: async (key: string, value: Response) => { entries.set(key, value); } }),
    match: async (key: string) => entries.get(key)?.clone(),
    delete: async () => { entries.clear(); return true; },
  });
  expect(await canDisplayPushFor("a")).toBe(false);
  await setPushSession("a");
  expect(await canDisplayPushFor("a")).toBe(true);
  expect(await canDisplayPushFor("b")).toBe(false);
  await Promise.all([setPushSession("b"), setPushSession(null)]);
  expect(await canDisplayPushFor("a")).toBe(false);
  expect(await canDisplayPushFor("b")).toBe(false);
});

it("rejects external, backslash, and non-HTTP notification/redirect targets", () => {
  const origin = "https://school.example";
  for (const value of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "blob:https://school.example/token"]) {
    expect(sameOriginUrl(value, origin, "/issues")).toBe(`${origin}/issues`);
  }
  expect(sameOriginUrl("/issues/c/id?tab=comments#reply", origin)).toBe(`${origin}/issues/c/id?tab=comments#reply`);
});
