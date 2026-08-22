import type { User } from "firebase/auth";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-gateway", () => ({
  apiGatewayUrl: (path: string) => `https://api.example.test${path}`,
  hasApiGatewayConfig: () => true,
}));

vi.mock("@/lib/backend-security", () => ({
  backendSecurityHeaders: async (token: string) => ({
    Authorization: `Bearer ${token}`,
  }),
}));

import { ensureBackendProfile } from "@/services/backend-auth";

describe("backend profile sync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reconciles the authenticated profile on every session bootstrap", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      Response.json({ ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = {
      email: "admin@example.test",
      getIdTokenResult: vi.fn().mockResolvedValue({ token: "firebase-token" }),
      uid: "admin-uid",
    } as unknown as User;

    await ensureBackendProfile(user);
    await ensureBackendProfile(user);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/v1/auth/sync",
      expect.objectContaining({ method: "POST" }),
    );
    expect(user.getIdTokenResult).toHaveBeenCalledTimes(2);
  });
});
