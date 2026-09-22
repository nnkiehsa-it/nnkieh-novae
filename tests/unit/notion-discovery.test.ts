import { afterEach, expect, it, vi } from "vitest";
import { withRuntimeEnvironment } from "../../cloudflare/src/backend/shared/env.ts";
import { getDataSourceId } from "../../cloudflare/src/backend/shared/notion-api.ts";
import type { Env } from "../../cloudflare/src/types.ts";

afterEach(() => { vi.unstubAllGlobals(); });
it("retries failed discovery and honors an explicit data source over the cache", async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response('{"code":"service_unavailable"}', { status: 503 }))
    .mockResolvedValueOnce(Response.json({ data_sources: [{ id: "discovered" }] }));
  vi.stubGlobal("fetch", fetch);
  const env = { NOTION_DATABASE_ID: "database", NOTION_TOKEN: "token" } as Env;
  await expect(withRuntimeEnvironment(env, () => getDataSourceId())).rejects.toThrow("503");
  await expect(withRuntimeEnvironment(env, () => getDataSourceId())).resolves.toBe("discovered");
  await expect(withRuntimeEnvironment({ ...env, NOTION_DATA_SOURCE_ID: "configured" }, () => getDataSourceId())).resolves.toBe("configured");
  expect(fetch).toHaveBeenCalledTimes(2);
});
