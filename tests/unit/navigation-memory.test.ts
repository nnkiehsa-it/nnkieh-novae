import { describe, expect, it } from "vitest";
import {
  commitRouteHistory,
  consumeRouteDirection,
  markRouteDirection,
} from "@/lib/navigation-memory";

describe("route depth motion", () => {
  it("keeps an explicit direction until the destination route commits", () => {
    expect(consumeRouteDirection("/issues/public")).toBe("root");
    expect(consumeRouteDirection("/facilities")).toBe("root");
    expect(consumeRouteDirection("/announcements")).toBe("root");
    expect(consumeRouteDirection("/notifications")).toBe("root");
    expect(consumeRouteDirection("/settings")).toBe("root");
    expect(consumeRouteDirection("/issues/public/issue-1")).toBe("child");
    expect(consumeRouteDirection("/facilities/facility-1")).toBe("child");
    expect(consumeRouteDirection("/dashboard")).toBe("child");

    markRouteDirection("back");
    expect(consumeRouteDirection("/issues/public")).toBe("back");
    expect(consumeRouteDirection("/issues/public")).toBe("back");
    commitRouteHistory("/issues/public");
    expect(consumeRouteDirection("/issues/public")).toBe("root");
  });
});
