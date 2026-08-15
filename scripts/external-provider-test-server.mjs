import { createServer } from "node:http";
import process from "node:process";

const requests = [];
let failNextMessages = 0;
const port = Number(process.env.NOVAE_EXTERNAL_PROVIDER_TEST_PORT || "54330");

function send(response, status, body, contentType = "application/json") {
  const value = contentType === "application/json" ? JSON.stringify(body) : body;
  response.writeHead(status, { "content-type": contentType });
  response.end(value);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const source = Buffer.concat(chunks).toString("utf8");
  const contentType = request.headers["content-type"] || "";
  if (contentType.includes("application/json")) return source ? JSON.parse(source) : {};
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(source));
  }
  if (contentType.includes("multipart/form-data")) {
    const result = {};
    for (const match of source.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/gu)) {
      result[match[1]] = match[2];
    }
    return result;
  }
  return {};
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname === "/__requests" && request.method === "DELETE") {
      requests.length = 0;
      failNextMessages = 0;
      send(response, 200, { ok: true });
      return;
    }
    if (url.pathname === "/__requests" && request.method === "GET") {
      send(response, 200, { requests });
      return;
    }
    if (request.method === "GET" && url.pathname.startsWith("/image/authenticated/")) {
      response.writeHead(200, {
        "cache-control": "public, max-age=3600",
        "content-type": "image/webp",
      });
      response.end(Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64"));
      return;
    }
    if (request.method !== "POST") {
      send(response, 405, "Method Not Allowed", "text/plain");
      return;
    }

    const body = await readBody(request);
    if (url.pathname === "/__fail-next") {
      failNextMessages = Math.max(0, Number(body.count) || 0);
      send(response, 200, { count: failNextMessages });
      return;
    }
    requests.push({ body, path: url.pathname });
    if (url.pathname.startsWith("/iid/")) {
      const tokens = Array.isArray(body.registration_tokens) ? body.registration_tokens : [];
      send(response, 200, { results: tokens.map(() => ({})) });
      return;
    }
    if (url.pathname.endsWith("/messages:send")) {
      if (failNextMessages > 0) {
        failNextMessages -= 1;
        send(response, 503, { error: "temporary-unavailable" });
        return;
      }
      send(response, 200, { name: `local/${requests.length}` });
      return;
    }
    if (url.pathname.endsWith("/image/destroy")) {
      send(response, 200, { result: "ok" });
      return;
    }
    send(response, 404, { error: "not-found" });
  } catch (error) {
    send(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`External provider test server listening on ${port}.`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

