import { createServer } from "node:http";
import process from "node:process";
import crypto from "node:crypto";

const requests = [];
let failNextMessages = 0;
const port = Number(process.env.NOVAE_EXTERNAL_PROVIDER_TEST_PORT || "54330");

// In-memory Notion emulator store
const notionPages = new Map();
const notionPageBlocks = new Map();

function send(response, status, body, contentType = "application/json") {
  const value = contentType === "application/json" ? JSON.stringify(body) : body;
  response.writeHead(status, {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
    "access-control-allow-origin": "*",
    "content-type": contentType,
  });
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
    const pathname = url.pathname;

    if (request.method === "OPTIONS") {
      send(response, 204, "", "text/plain");
      return;
    }

    if (pathname === "/__requests" && request.method === "DELETE") {
      requests.length = 0;
      failNextMessages = 0;
      notionPages.clear();
      notionPageBlocks.clear();
      send(response, 200, { ok: true });
      return;
    }
    if (pathname === "/__requests" && request.method === "GET") {
      send(response, 200, { requests, notionPages: Object.fromEntries(notionPages) });
      return;
    }

    // Cloudinary media delivery mock
    if (request.method === "GET" && pathname.startsWith("/image/authenticated/")) {
      response.writeHead(200, {
        "cache-control": "public, max-age=3600",
        "content-type": "image/webp",
      });
      response.end(Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64"));
      return;
    }
    if (request.method === "GET" && pathname.includes("/resources/image/authenticated/")) {
      send(response, 200, {
        bytes: 256,
        format: "webp",
        height: 64,
        resource_type: "image",
        type: "authenticated",
        width: 64,
      });
      return;
    }
    if (request.method === "PUT" && pathname.endsWith("/upload_presets/srp-secure-images")) {
      requests.push({ body: await readBody(request), path: pathname });
      send(response, 200, { message: "updated" });
      return;
    }

    // Notion API Emulator
    if (pathname.startsWith("/v1/")) {
      const notionSubpath = pathname.slice(3); // e.g. "/databases/..."

      if (request.method === "GET" && /^\/databases\/[^/]+$/u.test(notionSubpath)) {
        send(response, 200, {
          data_sources: [{ id: "mock-notion-datasource-id" }],
          id: "mock-database-id",
          object: "database",
        });
        return;
      }

      if (request.method === "POST" && /^\/data_sources\/[^/]+\/query$/u.test(notionSubpath)) {
        const body = await readBody(request);
        requests.push({ body, method: "POST", path: pathname });
        const equals = body?.filter?.rich_text?.equals;
        const requiresNovaeId = body?.filter?.rich_text?.is_not_empty === true;
        const matching = [];
        for (const [id, page] of notionPages.entries()) {
          const novaeId = page.properties?.["Novae ID"]?.rich_text?.[0]?.text?.content;
          if (page.archived !== true && ((equals && novaeId === equals) || (requiresNovaeId && novaeId))) {
            matching.push({ id, ...page });
          }
        }
        const pageSize = Math.min(100, Math.max(1, Number(body.page_size) || 100));
        const start = Math.max(0, Number(body.start_cursor) || 0);
        const end = Math.min(matching.length, start + pageSize);
        send(response, 200, {
          has_more: end < matching.length,
          next_cursor: end < matching.length ? String(end) : null,
          results: matching.slice(start, end),
        });
        return;
      }

      if (request.method === "PATCH" && /^\/data_sources\/[^/]+$/u.test(notionSubpath)) {
        const body = await readBody(request);
        requests.push({ body, method: "PATCH", path: pathname });
        send(response, 200, { object: "data_source", ok: true });
        return;
      }

      if (request.method === "POST" && notionSubpath === "/pages") {
        const body = await readBody(request);
        requests.push({ body, method: "POST", path: pathname });
        const pageId = crypto.randomUUID();
        const page = { id: pageId, object: "page", properties: body.properties || {} };
        notionPages.set(pageId, page);
        notionPageBlocks.set(pageId, []);
        send(response, 200, page);
        return;
      }

      if (request.method === "PATCH" && /^\/pages\/[^/]+$/u.test(notionSubpath)) {
        const body = await readBody(request);
        requests.push({ body, method: "PATCH", path: pathname });
        const pageId = notionSubpath.split("/")[2];
        const existing = notionPages.get(pageId) || { id: pageId, object: "page", properties: {} };
        existing.properties = { ...existing.properties, ...(body.properties || {}) };
        if (typeof body.archived === "boolean") existing.archived = body.archived;
        notionPages.set(pageId, existing);
        send(response, 200, existing);
        return;
      }

      if (request.method === "GET" && /^\/blocks\/[^/]+\/children$/u.test(notionSubpath)) {
        const blockId = notionSubpath.split("/")[2];
        const blocks = notionPageBlocks.get(blockId) || [];
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("page_size")) || 100));
        const start = Math.max(0, Number(url.searchParams.get("start_cursor")) || 0);
        const end = Math.min(blocks.length, start + pageSize);
        send(response, 200, {
          has_more: end < blocks.length,
          next_cursor: end < blocks.length ? String(end) : null,
          results: blocks.slice(start, end),
        });
        return;
      }

      if (request.method === "PATCH" && /^\/blocks\/[^/]+\/children$/u.test(notionSubpath)) {
        const body = await readBody(request);
        requests.push({ body, method: "PATCH", path: pathname });
        const blockId = notionSubpath.split("/")[2];
        const existingBlocks = notionPageBlocks.get(blockId) || [];
        const newBlocks = (body.children || []).map((b) => ({
          ...b,
          id: b.id || crypto.randomUUID(),
        }));
        existingBlocks.push(...newBlocks);
        notionPageBlocks.set(blockId, existingBlocks);
        send(response, 200, { results: newBlocks });
        return;
      }

      if (request.method === "DELETE" && /^\/blocks\/[^/]+$/u.test(notionSubpath)) {
        const blockId = notionSubpath.split("/")[2];
        for (const [pageId, blocks] of notionPageBlocks.entries()) {
          const filtered = blocks.filter((b) => b.id !== blockId);
          notionPageBlocks.set(pageId, filtered);
        }
        send(response, 200, { deleted: true, id: blockId });
        return;
      }

      if (request.method === "POST" && notionSubpath === "/file_uploads") {
        const body = await readBody(request);
        requests.push({ body, method: "POST", path: pathname });
        send(response, 200, {
          id: crypto.randomUUID(),
          upload_url: `http://127.0.0.1:${port}/mock-notion-file-upload`,
        });
        return;
      }
    }

    if (pathname === "/mock-notion-file-upload") {
      send(response, 200, { ok: true });
      return;
    }

    // Default POST routing for Cloudinary / FCM
    if (request.method !== "POST") {
      send(response, 405, "Method Not Allowed", "text/plain");
      return;
    }

    const body = await readBody(request);
    if (pathname === "/__fail-next") {
      failNextMessages = Math.max(0, Number(body.count) || 0);
      send(response, 200, { count: failNextMessages });
      return;
    }
    requests.push({ body, method: "POST", path: pathname });
    if (pathname.startsWith("/iid/")) {
      const tokens = Array.isArray(body.registration_tokens) ? body.registration_tokens : [];
      send(response, 200, { results: tokens.map(() => ({})) });
      return;
    }
    if (pathname.endsWith("/messages:send")) {
      if (failNextMessages > 0) {
        failNextMessages -= 1;
        send(response, 503, { error: "temporary-unavailable" });
        return;
      }
      send(response, 200, { name: `local/${requests.length}` });
      return;
    }
    if (pathname.endsWith("/image/destroy")) {
      send(response, 200, { result: "ok" });
      return;
    }
    if (pathname.endsWith("/image/upload")) {
      const publicId = `${body.folder}/${body.public_id}`;
      const version = 1;
      const signature = crypto
        .createHash("sha1")
        .update(`public_id=${publicId}&version=${version}integration-api-secret`)
        .digest("hex");
      send(response, 200, { public_id: publicId, signature, version });
      return;
    }
    if (pathname.endsWith("/upload_presets")) {
      send(response, 200, { message: "created" });
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
