import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, expect, it, vi } from "vitest";
import { TurnstileProvider, useTurnstile } from "@/components/turnstile-provider";

vi.hoisted(() => vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key"));
vi.mock("@/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("framework7-react", () => ({
  f7ready: (callback: (app: unknown) => void) => callback({
    dialog: {
      create: ({ el, on }: { el: HTMLElement; on: { closed: () => void } }) => ({
        open: () => el.classList.add("modal-in"),
        close: () => {
          if (!el.classList.contains("modal-in")) return;
          el.classList.remove("modal-in");
          on.closed();
        },
        destroy: vi.fn(),
        once: vi.fn(),
        $el: { off: vi.fn() },
      }),
    },
  }),
}));
afterAll(() => vi.unstubAllEnvs());

it("keeps the silent challenge iframe in the same native dialog host through interaction and completion", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const render = vi.fn(() => "widget-1");
  const remove = vi.fn();
  window.turnstile = { render, remove, execute: vi.fn() };
  let turnstile!: ReturnType<typeof useTurnstile>;
  function Probe() {
    turnstile = useTurnstile();
    return null;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(TurnstileProvider, null, createElement(Probe))));
    let result!: Promise<string | null>;
    await act(async () => { result = turnstile.requestToken("restore"); });
    const [host, callbacks] = render.mock.calls[0] as unknown as [HTMLElement, {
      "before-interactive-callback": () => void;
      callback: (token: string) => void;
    }];
    const dialog = host.closest(".dialog")!;
    expect(host.isConnected).toBe(true);
    expect(dialog.getAttribute("aria-hidden")).toBe("true");
    expect(turnstile.verifying).toBe(true);
    await act(async () => callbacks["before-interactive-callback"]());
    expect(dialog.classList.contains("modal-in")).toBe(true);
    expect(dialog.getAttribute("aria-hidden")).toBe("false");
    expect(dialog.contains(host)).toBe(true);
    await act(async () => callbacks.callback("test-token"));
    await expect(result).resolves.toBe("test-token");
    expect(host.isConnected).toBe(true);
    expect(render).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith("widget-1");
    expect(turnstile.verifying).toBe(false);
    expect(dialog.classList.contains("modal-in")).toBe(false);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    delete window.turnstile;
    vi.unstubAllGlobals();
  }
});
