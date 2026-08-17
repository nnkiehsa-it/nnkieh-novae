import { describe, expect, it, vi } from "vitest";
import { raceWithAbort } from "@/lib/abort-signal";
import { RequestFailure, withRequestTimeout } from "@/lib/request";

describe("abort signal race", () => {
  it("rejects without starting an operation when already aborted", async () => {
    const controller = new AbortController();
    const operation = vi.fn(() => new Promise<never>(() => undefined));
    controller.abort();

    await expect(
      raceWithAbort(controller.signal, operation, () => new Error("aborted")),
    ).rejects.toThrow("aborted");
    expect(operation).not.toHaveBeenCalled();
  });

  it("rejects a pending operation when the signal aborts", async () => {
    const controller = new AbortController();
    const pending = raceWithAbort(
      controller.signal,
      () => new Promise<never>(() => undefined),
      () => new Error("aborted"),
    );

    controller.abort();

    await expect(pending).rejects.toThrow("aborted");
  });

  it("preserves operation results and failures", async () => {
    const resolvedController = new AbortController();
    await expect(
      raceWithAbort(resolvedController.signal, async () => "done", () => new Error("aborted")),
    ).resolves.toBe("done");

    const rejectedController = new AbortController();
    await expect(
      raceWithAbort(
        rejectedController.signal,
        async () => { throw new Error("failed"); },
        () => new Error("aborted"),
      ),
    ).rejects.toThrow("failed");
  });

  it("prevents pre-aborted requests from starting backend work", async () => {
    const controller = new AbortController();
    const operation = vi.fn(async () => "unexpected");
    controller.abort();

    await expect(
      withRequestTimeout(operation, { signal: controller.signal }),
    ).rejects.toEqual(
      expect.objectContaining<RequestFailure>({ code: "aborted" }),
    );
    expect(operation).not.toHaveBeenCalled();
  });
});
