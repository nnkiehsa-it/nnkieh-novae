import { describe, expect, it, vi } from "vitest";
import {
  rememberCurrentRoute,
  returnToPreviousInAppRoute,
  returnToPreviousRoute,
} from "@/lib/navigation-memory";

describe("in-app return navigation", () => {
  it("returns to a matching previous route and otherwise uses its fallback", () => {
    const router = { back: vi.fn(), push: vi.fn() };
    rememberCurrentRoute("/issues/public");
    rememberCurrentRoute("/issues/public/issue-1");

    returnToPreviousRoute(router, "/issues/public", "/issues");
    expect(router.back).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();

    rememberCurrentRoute("/facilities");
    rememberCurrentRoute("/settings");
    returnToPreviousRoute(router, "/issues/public", "/issues");
    expect(router.push).toHaveBeenCalledWith("/issues/public");
  });

  it("returns to the last in-app route when one exists", () => {
    const router = { back: vi.fn(), push: vi.fn() };
    rememberCurrentRoute("/dashboard");
    returnToPreviousInAppRoute(router, "/settings");
    expect(router.back).toHaveBeenCalledOnce();
  });
});
