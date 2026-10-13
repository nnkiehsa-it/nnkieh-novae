import { afterEach, expect, it } from "vitest";
import { canStepBack, isInAppHref, navigate, pushAddress, setViewHostMounted } from "@/lib/app-navigation";

afterEach(() => {
  setViewHostMounted(false);
  window.history.replaceState(null, "", "/");
});

it("leaves navigation to the router until the view host is on screen", () => {
  window.history.replaceState(null, "", "/home");
  expect(navigate("/feed")).toBe(false);
  expect(window.location.pathname).toBe("/home");
});

it("changes screens in place and marks the entry as reached from inside the app", () => {
  setViewHostMounted(true);
  window.history.replaceState(null, "", "/feed");
  expect(canStepBack()).toBe(false);
  expect(navigate("/issues/public/abc")).toBe(true);
  expect(window.location.pathname).toBe("/issues/public/abc");
  expect(canStepBack()).toBe(true);
});

it("keeps the mark of the entry it replaces", () => {
  setViewHostMounted(true);
  window.history.replaceState(null, "", "/issues/public/abc");
  navigate("/feed?view=issues", { replace: true });
  expect(window.location.search).toBe("?view=issues");
  expect(canStepBack()).toBe(false);
});

it("never draws an address outside the signed-in app in place", () => {
  setViewHostMounted(true);
  expect(isInAppHref("/login")).toBe(false);
  expect(isInAppHref("https://github.com/tavricccc/novae")).toBe(false);
  expect(navigate("/login")).toBe(false);
});

it("does not stack an entry for the address already showing", () => {
  window.history.replaceState(null, "", "/feed?view=issues");
  const before = window.history.length;
  pushAddress("/feed?view=issues");
  expect(window.history.length).toBe(before);
});
