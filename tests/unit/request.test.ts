import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestFailure, safeFetch, withRequestTimeout } from "@/lib/request";

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), {
    headers: responseHeaders,
    status,
  });
}

describe("request timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

describe("safeFetch retries", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("honors Retry-After for a short 429 and retries the request", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(
        { error: { code: "rate-limit.read" }, success: false },
        429,
        { "Retry-After": "1" },
      ))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const request = safeFetch("/api/retry-me");
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(request).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not automatically retry an unsafe POST after an ambiguous network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(safeFetch("/api/write", { method: "POST" }))
      .rejects.toMatchObject({ code: "network" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries an explicitly retry-safe POST after a transient network failure", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const request = safeFetch(
      "/api/idempotent-write",
      { method: "POST" },
      { retry: { allowUnsafe: true } },
    );
    await vi.advanceTimersByTimeAsync(300);

    await expect(request).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries request-in-progress only when the POST is marked retry-safe", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(
        { error: { code: "request-in-progress" }, success: false },
        409,
      ))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const request = safeFetch(
      "/api/idempotent-write",
      { method: "POST" },
      { retry: { allowUnsafe: true } },
    );
    await vi.advanceTimersByTimeAsync(300);

    await expect(request).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces long rate limits instead of leaving the UI waiting", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(
      { error: { code: "rate-limit.operation", retryAfterSeconds: 60 }, success: false },
      429,
      { "Retry-After": "60" },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(safeFetch("/api/rate-limited")).rejects.toMatchObject({
      code: "rate-limit.operation",
      retryAfterSeconds: 60,
      status: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops retrying as soon as the parent request is aborted", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const parent = new AbortController();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const request = safeFetch(
      "/api/read",
      {},
      { signal: parent.signal },
    );
    await vi.advanceTimersByTimeAsync(100);
    parent.abort();

    await expect(request).rejects.toMatchObject({ code: "aborted" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
