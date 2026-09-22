import assert from "node:assert/strict";
import { build } from "esbuild";
import { SignJWT } from "jose";
import { Miniflare } from "miniflare";
import { integrationTest } from "./helpers.ts";

integrationTest("hibernatable sockets cannot receive events after ticket expiry", async () => {
  const secret = "realtime-regression-test-secret";
  const bundle = await build({ bundle: true, write: false, format: "esm", platform: "neutral", external: ["cloudflare:workers"], stdin: { resolveDir: process.cwd(), contents: `
    export { RealtimeHub } from './cloudflare/src/durable/realtime-hub.ts';
    export default { async fetch(request, env) {
      const hub = env.HUB.getByName('test');
      if (request.method === 'POST') return Response.json(await hub.publish(await request.json()));
      return hub.fetch(request);
    } };` } });
  const runtime = new Miniflare({ cf: false, workers: [{ config: {
    name: "realtime-test", type: "worker", compatibilityDate: "2025-09-01",
    manifest: { mainModule: "index.js", modules: { "index.js": { type: "esm", contents: bundle.outputFiles[0].text } } },
    exports: { RealtimeHub: { type: "durable-object", storage: "sqlite" } },
    env: { HUB: { type: "durable-object", worker: "realtime-test", exportName: "RealtimeHub" }, REALTIME_TICKET_SECRET: { type: "text", value: secret } },
  } }] });
  try {
    await runtime.ready;
    const expiresAt = Math.floor(Date.now() / 1000) + 2;
    const ticket = await new SignJWT({ topics: ["content:admin"] })
      .setProtectedHeader({ alg: "HS256" }).setSubject("admin")
      .setAudience("novae-realtime").setIssuer("novae-api").setExpirationTime(expiresAt)
      .sign(new TextEncoder().encode(secret));
    const response = await runtime.dispatchFetch("https://test.invalid/", { headers: { Upgrade: "websocket", "Sec-WebSocket-Protocol": `novae.realtime.v1, ${ticket}` } });
    assert.equal(response.status, 101);
    const socket = response.webSocket!;
    socket.accept();
    const publish = async () => {
      const sent = await runtime.dispatchFetch("https://test.invalid/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify([{ topic: "content:admin", event: "content_changed", id: crypto.randomUUID(), payload: {} }]) });
      return await sent.json() as { delivered: number };
    };
    assert.equal((await publish()).delivered, 1);
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, expiresAt * 1000 - Date.now()) + 50));
    assert.equal((await publish()).delivered, 0);
    socket.close();
  } finally { await runtime.dispose(); }
});
