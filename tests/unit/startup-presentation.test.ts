import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useStartupPresentation } from "../../src/hooks/use-startup-presentation";
import type { StartupPhase } from "../../src/hooks/session-state";

let root: Root;
let host: HTMLDivElement;
function Harness({ run, steps }: { run: number; steps: readonly StartupPhase[] }) {
  const presentation = useStartupPresentation({ startupRun: run, startupSteps: steps });
  return createElement("output", null, JSON.stringify(presentation));
}
function readPresentation(): ReturnType<typeof useStartupPresentation> {
  return JSON.parse(host.textContent!);
}
function render(run: number, steps: readonly StartupPhase[]) {
  act(() => root.render(createElement(Harness, { run, steps })));
}
function advance(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

it("presents a fast verified restoration in 420ms and does not replay on navigation", () => {
  const steps = ["session", "security", "account", "access", "ready"] as const;
  render(1, steps);
  expect(readPresentation()).toEqual({ phase: "session", pending: true });
  for (const phase of steps.slice(1)) {
    advance(80);
    expect(readPresentation()).toEqual({ phase, pending: true });
  }
  advance(99);
  expect(readPresentation().pending).toBe(true);
  advance(1);
  expect(readPresentation().pending).toBe(false);
  act(() => root.unmount());
  root = createRoot(host);
  render(1, steps);
  expect(readPresentation()).toEqual({ phase: "ready", pending: false });
});

it("waits on the actual security step and restarts for another session", () => {
  render(2, ["session", "security"]);
  advance(80);
  advance(10_000);
  expect(readPresentation()).toEqual({ phase: "security", pending: true });
  render(2, ["session", "security", "account", "access", "ready"]);
  advance(80);
  advance(80);
  advance(80);
  advance(100);
  expect(readPresentation()).toEqual({ phase: "ready", pending: false });
  render(3, ["session", "security"]);
  expect(readPresentation()).toEqual({ phase: "session", pending: true });
});
