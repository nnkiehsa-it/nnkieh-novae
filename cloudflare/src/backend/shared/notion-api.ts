import { requireEnv, optionalEnv } from "./env.ts";
import { createMediaDeliveryUrl } from "./media-delivery.ts";

/**
 * The Notion HTTP boundary: how a request is made, what a property looks like,
 * and how the database's own schema is grown to hold one.
 *
 * Everything above this file talks about proposals and audit entries. This file
 * is the only place that knows the shape of Notion's API, which of its columns
 * have been created in this isolate already, and how a block of text or an
 * image gets onto a page without being written twice.
 */
const NOTION_API_VERSION = "2026-03-11";
const knownSelectOptions = new Set<string>();
const knownDateProperties = new Set<string>();
const knownRichTextProperties = new Set<string>();
const knownNumberProperties = new Set<string>();
let discoveredDataSourceId: Promise<string> | undefined;
export function notionEnabled(): boolean {
  if (optionalEnv("NOTION_ENABLED") === "false") return false;
  return Boolean(optionalEnv("NOTION_TOKEN") && optionalEnv("NOTION_DATABASE_ID"));
}
export function notionBaseUrl(): string {
  const base = optionalEnv("NOTION_API_BASE_URL") || "https://api.notion.com";
  return base.replace(/\/+$/u, "");
}
export async function callNotionAPI(path: string, method: string, body?: unknown): Promise<unknown> {
  const base = notionBaseUrl();
  const url = path.startsWith("http") ? path : `${base}/v1${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${requireEnv("NOTION_TOKEN")}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_API_VERSION,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Notion API error (${response.status}): ${await response.text()}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}
export async function getDataSourceId(): Promise<string> {
  if (discoveredDataSourceId) return discoveredDataSourceId;
  discoveredDataSourceId = (async () => {
    const databaseId = requireEnv("NOTION_DATABASE_ID");
    const db = (await callNotionAPI(`/databases/${databaseId}`, "GET")) as {
      data_sources?: Array<{ id?: string }>;
    };
    const firstId = db.data_sources?.[0]?.id;
    if (!firstId) throw new Error("notion-data-source-missing");
    return firstId;
  })();
  return discoveredDataSourceId;
}
export function richTextProperty(value: unknown) {
  const content = String(value ?? "").trim();
  return {
    rich_text: content ? [{ type: "text", text: { content: content.slice(0, 2000) } }] : [],
  };
}
export function dateProperty(value: unknown) {
  if (!value) return { date: null };
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return { date: null };
  return { date: { start: parsed.toISOString() } };
}
export function numberProperty(value: unknown) {
  const parsed = Number(value);
  return { number: Number.isFinite(parsed) ? parsed : null };
}
export async function ensureSelectOption(propertyName: string, optionName: string): Promise<void> {
  if (!optionName) return;
  const key = `${propertyName}:${optionName}`;
  if (knownSelectOptions.has(key)) return;
  const dataSourceId = await getDataSourceId();
  await callNotionAPI(`/data_sources/${dataSourceId}`, "PATCH", {
    properties: {
      [propertyName]: { select: { options: [{ name: optionName }] } },
    },
  });
  knownSelectOptions.add(key);
}
export async function ensureRichTextProperty(propertyName: string): Promise<void> {
  if (knownRichTextProperties.has(propertyName)) return;
  const dataSourceId = await getDataSourceId();
  await callNotionAPI(`/data_sources/${dataSourceId}`, "PATCH", {
    properties: { [propertyName]: { rich_text: {} } },
  });
  knownRichTextProperties.add(propertyName);
}
export async function ensureNumberProperty(propertyName: string): Promise<void> {
  if (knownNumberProperties.has(propertyName)) return;
  const dataSourceId = await getDataSourceId();
  await callNotionAPI(`/data_sources/${dataSourceId}`, "PATCH", {
    properties: { [propertyName]: { number: { format: "number" } } },
  });
  knownNumberProperties.add(propertyName);
}
export async function ensureDateProperty(propertyName: string): Promise<void> {
  if (knownDateProperties.has(propertyName)) return;
  const dataSourceId = await getDataSourceId();
  await callNotionAPI(`/data_sources/${dataSourceId}`, "PATCH", {
    properties: { [propertyName]: { date: {} } },
  });
  knownDateProperties.add(propertyName);
}
export interface NotionBlock {
  id: string;
  type: string;
  [key: string]: unknown;
}
export function getBlockPlainText(block: NotionBlock): string {
  const type = typeof block.type === "string" ? block.type : "";
  const sub = block[type];
  if (sub && typeof sub === "object" && "rich_text" in sub && Array.isArray(sub.rich_text)) {
    return sub.rich_text
      .map((item: { plain_text?: string; text?: { content?: string } }) => item.plain_text ?? item.text?.content ?? "")
      .join("");
  }
  return "";
}
export async function fetchAllBlockChildren(pageId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let startCursor: string | undefined = undefined;
  let hasMore = true;
  while (hasMore) {
    const url = `/blocks/${pageId}/children?page_size=100${startCursor ? `&start_cursor=${startCursor}` : ""}`;
    const response = (await callNotionAPI(url, "GET")) as {
      results?: NotionBlock[];
      has_more?: boolean;
      next_cursor?: string | null;
    };
    if (Array.isArray(response.results)) {
      blocks.push(...response.results);
    }
    hasMore = Boolean(response.has_more && response.next_cursor);
    startCursor = response.next_cursor ?? undefined;
  }
  return blocks;
}
export async function appendTimelineBlockWithDeduplication(
  pageId: string,
  eventId: string,
  summary: string,
  details?: string,
): Promise<void> {
  const marker = `[eventId: ${eventId}]`;
  const matchingBlocks = (await fetchAllBlockChildren(pageId))
    .filter((block) => getBlockPlainText(block).includes(marker));

  if (matchingBlocks.length === 1) {
    return;
  }

  if (matchingBlocks.length > 1) {
    for (const duplicate of matchingBlocks.slice(1)) {
      await callNotionAPI(`/blocks/${duplicate.id}`, "DELETE");
    }
    const repaired = (await fetchAllBlockChildren(pageId))
      .filter((block) => getBlockPlainText(block).includes(marker));
    if (repaired.length !== 1) throw new Error("notion-event-marker-repair-failed");
    return;
  }

  const textContent = `${marker} ${summary}${details ? `\n${details}` : ""}`;
  const newBlock = {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: textContent.slice(0, 2000) } }],
    },
  };

  await callNotionAPI(`/blocks/${pageId}/children`, "PATCH", {
    children: [newBlock],
  });
  const verified = (await fetchAllBlockChildren(pageId))
    .filter((block) => getBlockPlainText(block).includes(marker));
  if (verified.length === 0) throw new Error("notion-event-marker-missing");
  for (const duplicate of verified.slice(1)) {
    await callNotionAPI(`/blocks/${duplicate.id}`, "DELETE");
  }
  if (verified.length > 1) {
    const repaired = (await fetchAllBlockChildren(pageId))
      .filter((block) => getBlockPlainText(block).includes(marker));
    if (repaired.length !== 1) throw new Error("notion-event-marker-repair-failed");
  }
}
export async function uploadImageToNotion(publicId: string, filename: string): Promise<string> {
  const delivery = await createMediaDeliveryUrl(publicId, "full", true, "notion-sync");
  const imageResponse = await fetch(delivery.url);
  if (!imageResponse.ok) throw new Error(`failed-to-fetch-image: ${imageResponse.status}`);
  const imageData = await imageResponse.arrayBuffer();

  const fileUpload = (await callNotionAPI("/file_uploads", "POST", {
    filename,
    content_type: "image/webp",
  })) as { id: string; upload_url?: string };

  if (fileUpload.upload_url) {
    const uploadRes = await fetch(fileUpload.upload_url, {
      method: "POST",
      body: imageData,
      headers: { "Content-Type": "image/webp" },
    });
    if (!uploadRes.ok) throw new Error(`notion-file-upload-failed: ${uploadRes.status}`);
  }
  return fileUpload.id;
}
export function splitNotionText(content: string): string[] {
  if (!content) return [];
  const chunks: string[] = [];
  for (let offset = 0; offset < content.length; offset += 1900) {
    chunks.push(content.slice(offset, offset + 1900));
  }
  return chunks;
}
