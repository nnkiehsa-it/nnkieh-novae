import { describe, expect, it, vi } from "vitest";
vi.mock("../../cloudflare/src/backend/shared/operation-policies.ts", () => ({ operationPolicies: () => ({ revision: 1 }) }));
import { streamingResponse } from "../../cloudflare/src/backend/actions/response.ts";

describe("streaming backend action responses", () => {
  it("does not log reader cancellation as a backend failure", async () => {
    const returned = vi.fn(async () => ({ done: true, value: undefined } as const));
    const onFailure = vi.fn(async () => ({ code: "internal-error" as const }));
    const { pump, response } = streamingResponse({ data: "first" }, {
      next: () => new Promise(() => {}), return: returned,
    }, crypto.randomUUID(), onFailure);
    const reader = response.body!.getReader();
    await reader.read();
    await reader.read();
    await reader.cancel("navigation");
    await pump;
    expect(returned).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("still reports genuine producer failures", async () => {
    const onFailure = vi.fn(async () => ({ code: "internal-error" as const }));
    const { pump, response } = streamingResponse({ data: "first" }, {
      next: async () => { throw new Error("database failed"); },
    }, crypto.randomUUID(), onFailure);
    const text = await response.text();
    await pump;
    expect(onFailure).toHaveBeenCalledOnce();
    expect(text).toContain('"type":"error"');
  });
  it("settles the pump and returns the generator when the request is aborted", async () => {
    let returned = false;
    const iterator = {
      next: async () => await new Promise<IteratorResult<{ data: string }>>(() => undefined),
      return: async () => {
        returned = true;
        return { done: true, value: undefined } as IteratorResult<{ data: string }>;
      },
    };

    const controller = new AbortController();
    const { pump, response } = streamingResponse(
      { data: "first" },
      iterator,
      crypto.randomUUID(),
      async () => ({ code: "internal", message: "failed" }),
      controller.signal,
    );
    const reader = response.body!.getReader();
    await reader.read();
    await reader.read();
    controller.abort(new Error("test-abort"));

    await expect(pump).resolves.toBeUndefined();
    expect(returned).toBe(true);
  });
});
