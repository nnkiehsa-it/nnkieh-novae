import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(async () => {}), save: vi.fn(async () => {}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ isAdmin: true, setupCompleted: false, refreshSessionAccess: mocks.refresh }) }));
vi.mock("@/hooks/use-categories", () => ({ useCategories: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/services/categories", () => ({ completeInitialSetup: mocks.save }));
vi.mock("@/hooks/use-action-feedback", () => ({ useActionFeedback: () => ({ busy: false, state: "idle", run: (fn: () => Promise<unknown>) => fn() }) }));
import { useInitialSetup } from "@/hooks/use-initial-setup";

it("facilities-only setup opens the category feed rather than a nonexistent report", async () => {
  const globals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = globals.IS_REACT_ACT_ENVIRONMENT;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement("div"));
  let setup!: ReturnType<typeof useInitialSetup>;
  function Probe() { setup = useInitialSetup(); return null; }
  try {
    await act(async () => root.render(createElement(Probe)));
    await act(async () => {
      setup.setIssuesEnabled(false);
      setup.setFacilities([{ id: "facility-a", label: "Facility A", isDefault: true }]);
    });
    await act(async () => setup.save());
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith("/facilities?category=facility-a");
  } finally {
    await act(async () => root.unmount());
    globals.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
