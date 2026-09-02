import type { AppDatabaseClient } from "../database/client.ts";
import { optionalEnv, requireEnv } from "./env.ts";
import { createMediaDeliveryUrl } from "./media-delivery.ts";

const STATUS_LABELS: Record<string, string> = {
  pending: "未回覆",
  "under-review": "待審核",
  processing: "處理中",
  "auto-rejected": "未通過",
  "review-rejected": "審核未通過",
  infeasible: "無法實行",
  completed: "已完成",
  已刪除: "已刪除",
  發布: "發布",
  "unable-to-handle": "無法處理",
};

const FACILITY_STATUS_LABELS: Record<string, string> = {
  pending: "待受理",
  processing: "處理中",
  completed: "已完成",
  "unable-to-handle": "無法處理",
};

type AppDatabase = AppDatabaseClient;
const NOTION_API_VERSION = "2026-03-11";
const UPLOAD_PATTERN = /!\[([^\]]*)\]\((upload:[0-9a-f-]+)\)/giu;
const NOTION_IMAGE_UPLOAD_CONCURRENCY = 2;

const knownSelectOptions = new Set<string>();
const knownDateProperties = new Set<string>();
const knownRichTextProperties = new Set<string>();
const knownNumberProperties = new Set<string>();
const knownFormulaProperties = new Set<string>();
let discoveredDataSourceId: Promise<string> | undefined;

function translateStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function translateFacilityStatus(status: string): string {
  return FACILITY_STATUS_LABELS[status] ?? status;
}

async function translateCategory(database: AppDatabase, targetType: string, category: string): Promise<string> {
  if (category === "公告") return "公告";
  const table = targetType === "facility" ? "facility_categories" : "issue_categories";
  const { data, error } = await database
    .table("app_private", table)
    .select("label")
    .eq("id", category)
    .maybeSingle();
  if (error) throw error;
  return String(data?.label ?? category);
}

function supportLabel(supportCount: unknown, supportGoal: unknown): string {
  const count = typeof supportCount === "number" ? supportCount : Number(supportCount ?? 0);
  const goal = typeof supportGoal === "number" ? supportGoal : Number(supportGoal ?? 0);
  if (!Number.isFinite(count)) return "0";
  if (!Number.isFinite(goal) || goal <= 0) return String(count);
  return `${count}/${goal}`;
}

export function notionEnabled(): boolean {
  if (optionalEnv("NOTION_ENABLED") === "false") return false;
  return Boolean(optionalEnv("NOTION_TOKEN") && optionalEnv("NOTION_DATABASE_ID"));
}

function notionBaseUrl(): string {
  const base = optionalEnv("NOTION_API_BASE_URL") || "https://api.notion.com";
  return base.replace(/\/+$/u, "");
}

async function callNotionAPI(path: string, method: string, body?: unknown): Promise<unknown> {
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

async function getDataSourceId(): Promise<string> {
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

function richTextProperty(value: unknown) {
  const content = String(value ?? "").trim();
  return {
    rich_text: content ? [{ type: "text", text: { content: content.slice(0, 2000) } }] : [],
  };
}

function dateProperty(value: unknown) {
  if (!value) return { date: null };
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return { date: null };
  return { date: { start: parsed.toISOString() } };
}

function numberProperty(value: unknown) {
  const parsed = Number(value);
  return { number: Number.isFinite(parsed) ? parsed : null };
}

async function ensureSelectOption(propertyName: string, optionName: string): Promise<void> {
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

async function ensureRichTextProperty(propertyName: string): Promise<void> {
  if (knownRichTextProperties.has(propertyName)) return;
  const dataSourceId = await getDataSourceId();
  await callNotionAPI(`/data_sources/${dataSourceId}`, "PATCH", {
    properties: { [propertyName]: { rich_text: {} } },
  });
  knownRichTextProperties.add(propertyName);
}

async function ensureNumberProperty(propertyName: string): Promise<void> {
  if (knownNumberProperties.has(propertyName)) return;
  const dataSourceId = await getDataSourceId();
  await callNotionAPI(`/data_sources/${dataSourceId}`, "PATCH", {
    properties: { [propertyName]: { number: { format: "number" } } },
  });
  knownNumberProperties.add(propertyName);
}

async function ensureDateProperty(propertyName: string): Promise<void> {
  if (knownDateProperties.has(propertyName)) return;
  const dataSourceId = await getDataSourceId();
  await callNotionAPI(`/data_sources/${dataSourceId}`, "PATCH", {
    properties: { [propertyName]: { date: {} } },
  });
  knownDateProperties.add(propertyName);
}

async function ensureFormulaProperty(propertyName: string, expression: string): Promise<void> {
  if (knownFormulaProperties.has(propertyName)) return;
  const dataSourceId = await getDataSourceId();
  await callNotionAPI(`/data_sources/${dataSourceId}`, "PATCH", {
    properties: { [propertyName]: { formula: { expression } } },
  });
  knownFormulaProperties.add(propertyName);
}

interface NotionBlock {
  id: string;
  type: string;
  [key: string]: unknown;
}

function getBlockPlainText(block: NotionBlock): string {
  const type = typeof block.type === "string" ? block.type : "";
  const sub = block[type];
  if (sub && typeof sub === "object" && "rich_text" in sub && Array.isArray(sub.rich_text)) {
    return sub.rich_text
      .map((item: { plain_text?: string; text?: { content?: string } }) => item.plain_text ?? item.text?.content ?? "")
      .join("");
  }
  return "";
}

async function fetchAllBlockChildren(pageId: string): Promise<NotionBlock[]> {
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

async function uploadImageToNotion(publicId: string, filename: string): Promise<string> {
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

function splitNotionText(content: string): string[] {
  if (!content) return [];
  const chunks: string[] = [];
  for (let offset = 0; offset < content.length; offset += 1900) {
    chunks.push(content.slice(offset, offset + 1900));
  }
  return chunks;
}

async function appendCreationTimeline(
  database: AppDatabase,
  pageId: string,
  eventId: string,
  summary: string,
  content: string,
): Promise<void> {
  const marker = `[eventId: ${eventId}]`;
  const existing = (await fetchAllBlockChildren(pageId))
    .filter((block) => getBlockPlainText(block).includes(marker));
  if (existing.length > 0) {
    await appendTimelineBlockWithDeduplication(pageId, eventId, summary, content);
    return;
  }

  const uploadIds = [...content.matchAll(/srp-upload:\/\/([0-9a-fA-F-]{36})/gu)]
    .map((match) => match[1]);
  const notionUploadIds: string[] = [];
  if (uploadIds.length > 0) {
    const { data: uploads, error } = await database
      .table("app_private", "uploads")
      .select("id,cloudinary_public_id")
      .in("id", [...new Set(uploadIds)]);
    if (error) throw error;
    for (const upload of uploads ?? []) {
      if (!upload.cloudinary_public_id) throw new Error("notion-image-public-id-missing");
      notionUploadIds.push(await uploadImageToNotion(
        String(upload.cloudinary_public_id),
        `${upload.id}.webp`,
      ));
    }
  }

  const textBlocks = splitNotionText(content).map((chunk) => ({
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: chunk } }] },
  }));
  await callNotionAPI(`/blocks/${pageId}/children`, "PATCH", {
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: `${marker} ${summary}`.slice(0, 2000) } }] },
      },
      ...textBlocks,
      ...notionUploadIds.map((id) => ({
        object: "block",
        type: "image",
        image: { type: "file_upload", file_upload: { id } },
      })),
    ],
  });
  const verified = (await fetchAllBlockChildren(pageId))
    .filter((block) => getBlockPlainText(block).includes(marker));
  if (verified.length !== 1) throw new Error("notion-creation-marker-verification-failed");
}

async function resolveDisplayName(database: AppDatabase, uid: unknown) {
  const normalizedUid = typeof uid === "string" ? uid : "";
  if (!normalizedUid) return "使用者";
  const { data, error } = await database
    .table("app_private", "user_profiles")
    .select("display_name")
    .eq("uid", normalizedUid)
    .maybeSingle();
  if (error) throw error;
  return String(data?.display_name ?? normalizedUid);
}

export async function getOrCreateNotionPage(
  database: AppDatabase,
  targetType: string,
  targetId: string,
  title: string,
  category: string,
  status: string,
  authorName: string,
  supportCount?: unknown,
  supportGoal?: unknown,
  countProperty: string | null = "附議數",
): Promise<string | null> {
  const externalId = `${targetType}:${targetId}`;
  const { data, error } = await database
    .table("app_private", "notion_pages")
    .select("notion_page_id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();
  if (error) throw error;

  if (data?.notion_page_id) {
    return String(data.notion_page_id);
  }

  const categoryLabel = await translateCategory(database, targetType, category);
  const statusLabel = translateStatus(status);
  await Promise.all([
    ensureSelectOption("分類", categoryLabel),
    ensureSelectOption("狀態", statusLabel),
    countProperty ? ensureRichTextProperty(countProperty) : Promise.resolve(),
    ensureRichTextProperty("Novae ID"),
  ]);

  const dataSourceId = await getDataSourceId();
  const existingRemote = (await callNotionAPI(`/data_sources/${dataSourceId}/query`, "POST", {
    filter: { property: "Novae ID", rich_text: { equals: externalId } },
    page_size: 1,
  })) as { results?: Array<{ id?: string }> };

  let pageId = existingRemote.results?.[0]?.id;
  if (!pageId) {
    const properties: Record<string, unknown> = {
      名稱: { title: [{ text: { content: title.slice(0, 2000) } }] },
      分類: { select: { name: categoryLabel } },
      狀態: { select: { name: statusLabel } },
      作者: { rich_text: [{ text: { content: authorName.slice(0, 2000) } }] },
      "Novae ID": { rich_text: [{ text: { content: externalId } }] },
    };
    if (countProperty) {
      properties[countProperty] = {
        rich_text: [{ text: { content: supportLabel(supportCount, supportGoal) } }],
      };
    }
    const result = (await callNotionAPI("/pages", "POST", {
      parent: { type: "data_source_id", data_source_id: dataSourceId },
      properties,
    })) as { id?: string };
    pageId = result?.id;
  }

  if (!pageId) throw new Error("Notion page creation did not return an ID");

  await database
    .table("app_private", "notion_pages")
    .upsert(
      {
        target_type: targetType,
        target_id: targetId,
        notion_page_id: pageId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "target_type,target_id" },
    );

  return pageId;
}

export async function syncDomainEventToNotion(
  database: AppDatabase,
  event: {
    event_id: string;
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    actor_uid: string;
    occurred_at: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  if (!notionEnabled()) return;
  const { event_id, event_type, aggregate_type, aggregate_id, actor_uid, payload } = event;

  switch (event_type) {
    case "issue.created": {
      const { data: issue } = await database
        .table("app_private", "issues")
        .select("title,content,category,status,author_uid,support_count,support_goal,created_at")
        .eq("id", aggregate_id)
        .maybeSingle();
      const authorName = await resolveDisplayName(database, issue?.author_uid ?? actor_uid);
      const title = String(issue?.title ?? payload.title ?? "未命名提案");
      const category = String(issue?.category ?? payload.category ?? "公共議題");
      const pageId = await getOrCreateNotionPage(
        database,
        "issue",
        aggregate_id,
        title,
        category,
        "pending",
        authorName,
        issue?.support_count ?? 0,
        issue?.support_goal,
      );
      if (!pageId) return;

      const content = String(issue?.content ?? payload.content ?? "");
      await appendCreationTimeline(
        database,
        pageId,
        event_id,
        `【提案建立】${title}`,
        content,
      );
      break;
    }

    case "issue.status_changed": {
      const { data: issue } = await database
        .table("app_private", "issues")
        .select("title,category,status,author_uid,support_count,support_goal,closed_at,result_content,review_rejection_reason")
        .eq("id", aggregate_id)
        .maybeSingle();
      const newStatus = String(issue?.status ?? payload.new_status ?? "pending");
      const authorName = await resolveDisplayName(database, issue?.author_uid);
      const pageId = await getOrCreateNotionPage(
        database,
        "issue",
        aggregate_id,
        String(issue?.title ?? payload.title ?? "提案"),
        String(issue?.category ?? "公共議題"),
        newStatus,
        authorName,
        issue?.support_count,
        issue?.support_goal,
      );
      if (!pageId) return;

      const newStatusLabel = translateStatus(newStatus);
      await ensureSelectOption("狀態", newStatusLabel);
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: {
          狀態: { select: { name: newStatusLabel } },
          結案時間: dateProperty(issue?.closed_at),
          審核未通過原因: richTextProperty(issue?.review_rejection_reason),
          提案結果: richTextProperty(issue?.result_content),
        },
      });
      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        `【狀態變更】${newStatusLabel}`,
        issue?.review_rejection_reason ? `審核未通過原因：${issue.review_rejection_reason}` : undefined,
      );
      break;
    }

    case "issue.result_updated": {
      const pageId = await getOrCreateNotionPage(
        database, "issue", aggregate_id, "提案", "公共議題", "completed", "使用者",
      );
      if (!pageId) return;
      const resultContent = String(payload.result_content ?? "");
      await ensureRichTextProperty("提案結果");
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: { 提案結果: richTextProperty(resultContent) },
      });
      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        "【提案結果更新】",
        resultContent,
      );
      break;
    }

    case "support.goal_met":
    case "support.toggled": {
      const { data: issue } = await database
        .table("app_private", "issues")
        .select("title,category,status,author_uid,support_count,support_goal")
        .eq("id", aggregate_id)
        .maybeSingle();
      const pageId = await getOrCreateNotionPage(
        database,
        "issue",
        aggregate_id,
        String(issue?.title ?? "提案"),
        String(issue?.category ?? "公共議題"),
        String(issue?.status ?? "pending"),
        await resolveDisplayName(database, issue?.author_uid),
        issue?.support_count,
        issue?.support_goal,
      );
      if (!pageId) return;

      const label = supportLabel(issue?.support_count, issue?.support_goal);
      await ensureRichTextProperty("附議數");
      await ensureNumberProperty("附議數量");
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: {
          附議數: { rich_text: [{ text: { content: label } }] },
          附議數量: numberProperty(issue?.support_count),
        },
      });

      if (event_type === "support.goal_met") {
        await appendTimelineBlockWithDeduplication(
          pageId,
          event_id,
          `【附議達標】目前附議數：${label}，已達門檻！`,
        );
      }
      break;
    }

    case "issue.comment_created": {
      const pageId = await getOrCreateNotionPage(
        database, "issue", aggregate_id, "提案", "公共議題", "pending", "使用者",
      );
      if (!pageId) return;
      const author = await resolveDisplayName(database, actor_uid);
      const content = String(payload.content ?? "");
      await appendTimelineBlockWithDeduplication(pageId, event_id, `【新留言】${author}`, content);
      break;
    }

    case "issue.deleted": {
      const pageId = await getOrCreateNotionPage(
        database, "issue", aggregate_id, "提案", "公共議題", "已刪除", "使用者",
      );
      if (!pageId) return;
      await ensureSelectOption("狀態", "已刪除");
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: { 狀態: { select: { name: "已刪除" } } },
      });
      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        "【提案刪除】此提案已自 Novae 刪除",
      );
      break;
    }

    case "facility.created": {
      const { data: facility } = await database
        .table("app_private", "facility_reports")
        .select("title,content,location,status,author_uid,affected_count,category_id,created_at")
        .eq("id", aggregate_id)
        .maybeSingle();
      const authorName = await resolveDisplayName(database, facility?.author_uid ?? actor_uid);
      const title = String(facility?.title ?? payload.title ?? "未命名設備報修");
      const pageId = await getOrCreateNotionPage(
        database,
        "facility",
        aggregate_id,
        title,
        String(facility?.category_id ?? payload.category_id ?? "設備"),
        translateFacilityStatus(String(facility?.status ?? "pending")),
        authorName,
        facility?.affected_count ?? 1,
        null,
        "遇到人數",
      );
      if (!pageId) return;

      await ensureRichTextProperty("地點");
      await ensureDateProperty("建立時間");
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: {
          地點: richTextProperty(facility?.location),
          建立時間: dateProperty(facility?.created_at),
        },
      });

      await appendCreationTimeline(
        database,
        pageId,
        event_id,
        `【報修建立】${title} (地點: ${String(facility?.location ?? "")})`,
        String(facility?.content ?? ""),
      );
      break;
    }

    case "facility.status_changed": {
      const { data: facility } = await database
        .table("app_private", "facility_reports")
        .select("title,category_id,status,author_uid,affected_count,closed_at,result_content")
        .eq("id", aggregate_id)
        .maybeSingle();
      const statusLabel = translateFacilityStatus(String(facility?.status ?? payload.new_status ?? "pending"));
      const pageId = await getOrCreateNotionPage(
        database,
        "facility",
        aggregate_id,
        String(facility?.title ?? "設備"),
        String(facility?.category_id ?? "設備"),
        statusLabel,
        await resolveDisplayName(database, facility?.author_uid),
        facility?.affected_count,
        null,
        "遇到人數",
      );
      if (!pageId) return;

      await ensureSelectOption("狀態", statusLabel);
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: {
          狀態: { select: { name: statusLabel } },
          結案時間: dateProperty(facility?.closed_at),
        },
      });

      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        `【狀態變更】${statusLabel}`,
        facility?.result_content ? `處理說明：${facility.result_content}` : undefined,
      );
      break;
    }

    case "facility.deleted": {
      const pageId = await getOrCreateNotionPage(
        database, "facility", aggregate_id, "設備", "設備", "已刪除", "使用者",
      );
      if (!pageId) return;
      await ensureSelectOption("狀態", "已刪除");
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: { 狀態: { select: { name: "已刪除" } } },
      });
      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        "【報修刪除】此設備報修已自 Novae 刪除",
      );
      break;
    }

    case "announcement.created": {
      const { data: announcement } = await database
        .table("app_private", "announcements")
        .select("title,content,author_uid,published_at")
        .eq("id", aggregate_id)
        .maybeSingle();
      const title = String(announcement?.title ?? payload.title ?? "未命名公告");
      const authorName = await resolveDisplayName(database, announcement?.author_uid ?? actor_uid);
      const pageId = await getOrCreateNotionPage(
        database,
        "announcement",
        aggregate_id,
        title,
        "公告",
        "發布",
        authorName,
      );
      if (!pageId) return;

      await appendCreationTimeline(
        database,
        pageId,
        event_id,
        `【公告發布】${title}`,
        String(announcement?.content ?? payload.content ?? ""),
      );
      break;
    }

    case "announcement.deleted": {
      const pageId = await getOrCreateNotionPage(
        database, "announcement", aggregate_id, "公告", "公告", "已刪除", "使用者",
      );
      if (!pageId) return;
      await ensureSelectOption("狀態", "已刪除");
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: { 狀態: { select: { name: "已刪除" } } },
      });
      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        "【公告刪除】此公告已自 Novae 刪除",
      );
      break;
    }

    case "announcement.comment_created": {
      const pageId = await getOrCreateNotionPage(
        database, "announcement", aggregate_id, "公告", "公告", "發布", "使用者",
      );
      if (!pageId) return;
      const author = await resolveDisplayName(database, actor_uid);
      const content = String(payload.content ?? "");
      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        `【公告留言】${author}`,
        content,
      );
      break;
    }

    case "admin.audit_recorded": {
      const action = String(payload.action ?? "管理操作");
      const actorName = await resolveDisplayName(database, actor_uid);
      const pageId = await getOrCreateNotionPage(
        database,
        "admin-audit",
        aggregate_id,
        `【管理稽核】${action}`,
        "管理操作",
        "已記錄",
        actorName,
        undefined,
        undefined,
        null,
      );
      if (!pageId) return;

      await Promise.all([
        ensureDateProperty("操作時間"),
        ensureRichTextProperty("操作類型"),
        ensureRichTextProperty("操作領域"),
        ensureRichTextProperty("目標 ID"),
        ensureRichTextProperty("詳細資料"),
      ]);

      const detail = (payload.detail ?? {}) as Record<string, unknown>;
      await callNotionAPI(`/pages/${pageId}`, "PATCH", {
        properties: {
          操作時間: dateProperty(event.occurred_at),
          操作類型: richTextProperty(action),
          操作領域: richTextProperty(payload.domain),
          "目標 ID": richTextProperty(payload.target_id),
          詳細資料: richTextProperty(JSON.stringify(detail)),
        },
      });

      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        `【管理稽核】${action} 由 ${actorName}`,
        JSON.stringify(detail, null, 2),
      );
      break;
    }

    default: {
      // General/system/category management events
      const pageId = await getOrCreateNotionPage(
        database,
        aggregate_type,
        aggregate_id,
        `系統事件: ${event_type}`,
        "系統維運",
        "已處理",
        await resolveDisplayName(database, actor_uid),
      );
      if (pageId) {
        await appendTimelineBlockWithDeduplication(
          pageId,
          event_id,
          `【系統事件】${event_type}`,
          JSON.stringify(payload),
        );
      }
      break;
    }
  }
}

async function archiveManagedNotionPages(): Promise<number> {
  const dataSourceId = await getDataSourceId();
  let archived = 0;
  let startCursor: string | undefined;
  do {
    const response = (await callNotionAPI(`/data_sources/${dataSourceId}/query`, "POST", {
      filter: { property: "Novae ID", rich_text: { is_not_empty: true } },
      page_size: 100,
      ...(startCursor ? { start_cursor: startCursor } : {}),
    })) as {
      has_more?: boolean;
      next_cursor?: string | null;
      results?: Array<{ id?: string }>;
    };
    for (const page of response.results ?? []) {
      if (!page.id) throw new Error("notion-managed-page-id-missing");
      await callNotionAPI(`/pages/${page.id}`, "PATCH", { archived: true });
      archived += 1;
    }
    startCursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    if (response.has_more && !startCursor) throw new Error("notion-query-cursor-missing");
  } while (startCursor);
  return archived;
}

export async function reconcileNotionPages(database: AppDatabase): Promise<{ archived: number; reconciled: number }> {
  if (!notionEnabled()) return { archived: 0, reconciled: 0 };
  let reconciled = 0;
  const archived = await archiveManagedNotionPages();
  const { error: mappingError } = await database.table("app_private", "notion_pages").delete();
  if (mappingError) throw mappingError;

  const { data: issues, error: issueError } = await database
    .table("app_private", "issues")
    .select("id,title,content,category,status,author_uid,support_count,support_goal");
  if (issueError) throw issueError;

  for (const issue of issues ?? []) {
    const authorName = await resolveDisplayName(database, issue.author_uid);
    const pageId = await getOrCreateNotionPage(
      database,
      "issue",
      issue.id,
      issue.title,
      issue.category,
      issue.status,
      authorName,
      issue.support_count,
      issue.support_goal,
    );
    if (!pageId) throw new Error("notion-issue-page-missing");
    await appendCreationTimeline(
      database,
      pageId,
      `migration-0016:issue:${issue.id}`,
      `【遷移快照】${issue.title}`,
      String(issue.content ?? ""),
    );
    reconciled += 1;
  }

  const { data: facilities, error: facilityError } = await database
    .table("app_private", "facility_reports")
    .select("id,title,content,location,category_id,status,author_uid,affected_count");
  if (facilityError) throw facilityError;

  for (const facility of facilities ?? []) {
    const authorName = await resolveDisplayName(database, facility.author_uid);
    const pageId = await getOrCreateNotionPage(
      database,
      "facility",
      facility.id,
      facility.title,
      facility.category_id,
      translateFacilityStatus(facility.status),
      authorName,
      facility.affected_count,
      null,
      "遇到人數",
    );
    if (!pageId) throw new Error("notion-facility-page-missing");
    await appendCreationTimeline(
      database,
      pageId,
      `migration-0016:facility:${facility.id}`,
      `【遷移快照】${facility.title}（${String(facility.location ?? "")}）`,
      String(facility.content ?? ""),
    );
    reconciled += 1;
  }

  const { data: announcements, error: announcementError } = await database
    .table("app_private", "announcements")
    .select("id,title,content,author_uid,published_at");
  if (announcementError) throw announcementError;
  for (const announcement of announcements ?? []) {
    const pageId = await getOrCreateNotionPage(
      database,
      "announcement",
      announcement.id,
      announcement.title,
      "公告",
      "發布",
      await resolveDisplayName(database, announcement.author_uid),
      undefined,
      undefined,
      null,
    );
    if (!pageId) throw new Error("notion-announcement-page-missing");
    await appendCreationTimeline(
      database,
      pageId,
      `migration-0016:announcement:${announcement.id}`,
      `【遷移快照】${announcement.title}`,
      String(announcement.content ?? ""),
    );
    reconciled += 1;
  }

  const { data: audits, error: auditError } = await database
    .table("app_private", "admin_audit_log")
    .select("id,actor_uid,action,domain,target_id,detail,created_at");
  if (auditError) throw auditError;
  for (const audit of audits ?? []) {
    const pageId = await getOrCreateNotionPage(
      database,
      "admin-audit",
      String(audit.id),
      `【管理稽核】${audit.action}`,
      "管理操作",
      "已記錄",
      await resolveDisplayName(database, audit.actor_uid),
      undefined,
      undefined,
      null,
    );
    if (!pageId) throw new Error("notion-audit-page-missing");
    await Promise.all([
      ensureDateProperty("操作時間"),
      ensureRichTextProperty("操作類型"),
      ensureRichTextProperty("操作領域"),
      ensureRichTextProperty("目標 ID"),
      ensureRichTextProperty("詳細資料"),
    ]);
    await callNotionAPI(`/pages/${pageId}`, "PATCH", {
      properties: {
        操作時間: dateProperty(audit.created_at),
        操作類型: richTextProperty(audit.action),
        操作領域: richTextProperty(audit.domain),
        "目標 ID": richTextProperty(audit.target_id),
        詳細資料: richTextProperty(JSON.stringify(audit.detail ?? {})),
      },
    });
    await appendTimelineBlockWithDeduplication(
      pageId,
      `migration-0016:admin-audit:${audit.id}`,
      `【遷移稽核】${audit.action}`,
      JSON.stringify(audit.detail ?? {}, null, 2),
    );
    reconciled += 1;
  }

  return { archived, reconciled };
}

export async function markNotionPageDeleted(pageId: string): Promise<void> {
  if (!notionEnabled()) return;
  await callNotionAPI(`/pages/${pageId}`, "PATCH", { archived: true });
}
