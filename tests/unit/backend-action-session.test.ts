import { afterEach, expect, it, vi } from "vitest";
const session = vi.hoisted(() => ({ currentUser: { uid: "first" } }));
vi.mock("@/lib/firebase", () => ({ auth: session }));
vi.mock("@/lib/auth-token", () => ({ getFirebaseIdToken: async () => "token" }));
vi.mock("@/lib/backend-security", () => ({ backendSecurityHeaders: async () => ({ Authorization: "Bearer token" }) }));
vi.mock("@/lib/api-gateway", () => ({ apiGatewayUrl: () => "https://api.example.test/v1/actions" }));
import { invokeBackendAction } from "@/services/backend-action";

afterEach(() => { vi.unstubAllGlobals(); });
it("does not emit a segment or return data from a previous session", async () => {
  session.currentUser = { uid: "first" };
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  let headers!: () => void;
  const ready = new Promise<void>((resolve) => { headers = resolve; });
  const cancel = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async () => {
    const response = new Response(new ReadableStream<Uint8Array>({ start(controller) { stream = controller; }, cancel }));
    headers();
    return response;
  }));
  const onSegment = vi.fn();
  const pending = invokeBackendAction("getContentVersions", { onSegment })({});
  const rejected = expect(pending).rejects.toThrow("auth.loginStatusChangedPreviousResponseIgnored");
  await ready;
  // Wait until headers have been processed, then change the identity while the body is pending.
  await new Promise((resolve) => setTimeout(resolve, 0));
  session.currentUser = { uid: "second" };
  stream.enqueue(new TextEncoder().encode('{"type":"start","operationId":"old","policyRevision":1}\n{"type":"part","data":{"secret":"first"}}\n{"type":"end"}\n'));
  await rejected;
  expect(onSegment).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
});
