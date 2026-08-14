import { describe, expect, it } from "vitest";
import {
  consumeRouteDirection,
  markRouteDirection,
} from "@/lib/navigation-memory";

describe("route depth motion", () => {
  it("maps primary destinations to root motion and secondary destinations to child motion", () => {
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
    expect(consumeRouteDirection("/issues/public")).toBe("root");
  });
});
