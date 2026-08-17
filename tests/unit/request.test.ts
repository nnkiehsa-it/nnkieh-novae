import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestFailure, withRequestTimeout } from "@/lib/request";

describe("request timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not start an operation when its parent request was already aborted", async () => {
    const parent = new AbortController();
    const operation = vi.fn(async () => "unexpected");
    parent.abort();

    await expect(withRequestTimeout(operation, { signal: parent.signal }))
      .rejects.toMatchObject({ code: "aborted" });
    expect(operation).not.toHaveBeenCalled();
  });

  it("rejects when an active parent request is aborted even if the operation ignores its signal", async () => {
    const parent = new AbortController();
    const request = withRequestTimeout(
      () => new Promise<never>(() => undefined),
      { signal: parent.signal },
    );

    parent.abort();

    await expect(request).rejects.toMatchObject({ code: "aborted" });
  });

  it("reports a timeout when the operation does not settle", async () => {
    vi.useFakeTimers();
    const request = withRequestTimeout(
      () => new Promise<never>(() => undefined),
      { timeoutMs: 100 },
    );
    const rejection = expect(request).rejects.toEqual(expect.objectContaining({
      code: "timeout",
      name: RequestFailure.name,
    }));

    await vi.advanceTimersByTimeAsync(100);

    await rejection;
  });
});
