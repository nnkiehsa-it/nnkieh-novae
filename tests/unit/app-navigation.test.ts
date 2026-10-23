import { afterEach, beforeEach, expect, it } from "vitest";
import { createBrowserRouter } from "react-router";
import { bindRouter, canStepBack, isInAppHref, navigate, pushAddress } from "@/lib/app-navigation";

let router: ReturnType<typeof createBrowserRouter>;

beforeEach(() => {
  window.history.replaceState(null, "", "/feed");
  router = createBrowserRouter([{ path: "*" }]);
  bindRouter(router);
});

afterEach(() => {
  bindRouter(null);
  router.dispose();
  window.history.replaceState(null, "", "/");
});

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

it("leaves navigation to the page until there is a router", () => {
  bindRouter(null);
  expect(navigate("/home")).toBe(false);
  expect(window.location.pathname).toBe("/feed");
});

it("changes screens in place and marks the entry as reached from inside the app", async () => {
  expect(canStepBack()).toBe(false);
  expect(navigate("/issues/public/abc")).toBe(true);
  await settled();
  expect(window.location.pathname).toBe("/issues/public/abc");
  expect(canStepBack()).toBe(true);
});

it("keeps the mark of the entry it replaces", async () => {
  navigate("/feed?view=issues", { replace: true });
  await settled();
  expect(window.location.search).toBe("?view=issues");
  expect(canStepBack()).toBe(false);
  navigate("/issues/public/abc");
  await settled();
  navigate("/issues/public/def", { replace: true });
  await settled();
  expect(canStepBack()).toBe(true);
});

it("tells signed-in screens apart, and never routes another origin", () => {
  expect(isInAppHref("/feed")).toBe(true);
  expect(isInAppHref("/login")).toBe(false);
  expect(navigate("https://github.com/tavricccc/novae")).toBe(false);
  expect(navigate("//github.com/tavricccc/novae")).toBe(false);
});

it("does not stack an entry for the address already showing", async () => {
  navigate("/feed?view=issues", { replace: true });
  await settled();
  const before = window.history.length;
  pushAddress("/feed?view=issues");
  await settled();
  expect(window.history.length).toBe(before);
});
