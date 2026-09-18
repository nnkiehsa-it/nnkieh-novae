import { describe, expect, it } from "vitest";
import { streamingResponse } from "../../cloudflare/src/backend/actions/response.ts";

describe("streaming backend action responses", () => {
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
