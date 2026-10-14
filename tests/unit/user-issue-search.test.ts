import { beforeEach, expect, it, vi } from "vitest";
import { listUserIssues } from "@/services/issues";

const backend = vi.hoisted(() => vi.fn(async () => ({
  cursor: null, hasMore: false, issues: [], statusCounts: null, version: 1,
})));
vi.mock("@/services/backend-action", () => ({ callAction: (_name: string, payload: unknown) => backend(payload) }));
vi.mock("@/lib/request", () => ({ readRequestTimeoutMs: 1_000, RequestFailure: class extends Error {} }));
vi.mock("@/services/content-versions", () => ({ registerContentVersion: vi.fn() }));
vi.mock("@/services/backend-errors", () => ({
  isContentUnavailableError: () => false,
  toReadableBackendError: (error: unknown) => error,
}));

beforeEach(() => vi.clearAllMocks());

it("sends a trimmed search to the reader's paginated issue endpoint", async () => {
  await listUserIssues({ query: "  圖書館  ", statusBucket: "closed" });
  expect(backend).toHaveBeenCalledWith(expect.objectContaining({ query: "圖書館", statusBucket: "closed" }));
});
