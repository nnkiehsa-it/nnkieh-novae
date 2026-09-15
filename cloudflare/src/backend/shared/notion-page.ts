import type { AppDatabaseClient } from "../database/client.ts";
import type { Selected } from "../database/schema.ts";
import {
  callNotionAPI,
  ensureRichTextProperty,
  ensureSelectOption,
  getDataSourceId,
  notionEnabled,
  notionPageGone,
  richTextProperty,
  uploadImageToNotion,
} from "./notion-api.ts";
import type { NotionTimelineEntry } from "./notion-timeline.ts";

/**
 * The page a piece of Novae has in Notion.
 *
 * One proposal, facility report, announcement or audit entry is one page, found
 * or created by the identifier Novae writes into it, and its first timeline
 * entry carries the body and the images the body refers to. The words a reader
 * sees on that page are Novae's own vocabulary translated into the labels the
 * Notion database uses.
 */
type AppDatabase = AppDatabaseClient;
const STATUS_LABELS: Record<string, string> = {
  pending: "未回覆",
  "under-review": "待審核",
  processing: "處理中",
  "auto-rejected": "未達附議門檻",
  "review-rejected": "審核未通過",
  infeasible: "無法實行",
  completed: "已完成",
  已刪除: "已刪除",
  已發布: "已發布",
  已記錄: "已記錄",
  "unable-to-handle": "無法處理",
};
const FACILITY_STATUS_LABELS: Record<string, string> = {
  pending: "待受理",
  processing: "處理中",
  completed: "已完成",
  "unable-to-handle": "無法處理",
};
export function translateStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
export function translateFacilityStatus(status: string): string {
  return FACILITY_STATUS_LABELS[status] ?? status;
}
export async function translateCategory(database: AppDatabase, targetType: string, category: string): Promise<string> {
  if (category === "公告" || category === "系統維運") return category;
  const found = targetType === "facility"
    ? await database.sqlMaybe<Selected<"facility_categories", "label">>`
      select label from app_private.facility_categories where id = ${category}`
    : await database.sqlMaybe<Selected<"issue_categories", "label">>`
      select label from app_private.issue_categories where id = ${category}`;
  return found?.label ?? category;
}
export function supportLabel(supportCount: unknown, supportGoal: unknown): string {
  const count = typeof supportCount === "number" ? supportCount : Number(supportCount ?? 0);
  const goal = typeof supportGoal === "number" ? supportGoal : Number(supportGoal ?? 0);
  if (!Number.isFinite(count)) return "0";
  if (!Number.isFinite(goal) || goal <= 0) return String(count);
  return `${count}/${goal}`;
}
export async function resolveDisplayName(database: AppDatabase, uid: unknown) {
  const normalizedUid = typeof uid === "string" ? uid : "";
  if (!normalizedUid) return "使用者";
  const profile = await database.sqlMaybe<Selected<"user_profiles", "display_name">>`
    select display_name from app_private.user_profiles where uid = ${normalizedUid}`;
  return profile?.display_name ?? normalizedUid;
}
/**
 * A record's own body as a timeline entry: the text, and the pictures the text
 * refers to.
 *
 * The body names its images by upload id, which has to be turned into a file
 * Notion holds before a block can point at one. That costs a request per
 * image, so it happens only when the page turns out not to carry this entry
 * already.
 */
export function contentTimelineEntry(
  database: AppDatabase,
  eventId: string,
  summary: string,
  content: string,
): NotionTimelineEntry {
  return {
    details: content,
    eventId,
    images: async () => {
      const uploadIds = [...new Set(
        [...content.matchAll(/srp-upload:\/\/([0-9a-fA-F-]{36})/gu)].map((match) => match[1]),
      )];
      if (uploadIds.length === 0) return [];
      const { rows } = await database.sql<Selected<"uploads", "id" | "cloudinary_public_id">>`
        select id, cloudinary_public_id from app_private.uploads where id = any(${uploadIds})`;
      const notionUploadIds: string[] = [];
      for (const upload of rows) {
        if (!upload.cloudinary_public_id) throw new Error("notion-image-public-id-missing");
        notionUploadIds.push(await uploadImageToNotion(
          String(upload.cloudinary_public_id),
          `${upload.id}.webp`,
        ));
      }
      return notionUploadIds;
    },
    summary,
  };
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
  const mapped = await database.sqlMaybe<Selected<"notion_pages", "notion_page_id">>`
    select notion_page_id from app_private.notion_pages
    where target_type = ${targetType} and target_id = ${targetId}`;
  const categoryLabel = await translateCategory(database, targetType, category);
  const statusLabel = translateStatus(status);
  await Promise.all([
    ensureSelectOption("分類", categoryLabel),
    ensureSelectOption("狀態", statusLabel),
    ensureRichTextProperty("作者"),
    countProperty ? ensureRichTextProperty(countProperty) : Promise.resolve(),
    ensureRichTextProperty("Novae ID"),
  ]);

  const dataSourceId = await getDataSourceId();
  let pageId = mapped?.notion_page_id;
  if (!pageId) {
    const existingRemote = (await callNotionAPI(`/data_sources/${dataSourceId}/query`, "POST", {
      filter: { property: "Novae ID", rich_text: { equals: externalId } },
      page_size: 1,
    })) as { results?: Array<{ id?: string }> };
    pageId = existingRemote.results?.[0]?.id;
  }

  const properties: Record<string, unknown> = {
    名稱: { title: [{ text: { content: title.slice(0, 2000) } }] },
    分類: { select: { name: categoryLabel } },
    狀態: { select: { name: statusLabel } },
    作者: richTextProperty(authorName),
    "Novae ID": richTextProperty(externalId),
  };
  if (countProperty) properties[countProperty] = richTextProperty(supportLabel(supportCount, supportGoal));

  if (!pageId) {
    const result = (await callNotionAPI("/pages", "POST", {
      parent: { type: "data_source_id", data_source_id: dataSourceId },
      properties,
    })) as { id?: string };
    pageId = result?.id;
  } else {
    await callNotionAPI(`/pages/${pageId}`, "PATCH", { properties });
  }

  if (!pageId) throw new Error("Notion page creation did not return an ID");

  await database.sql`
    insert into app_private.notion_pages (target_type, target_id, notion_page_id, updated_at)
    values (${targetType}, ${targetId}, ${pageId}, ${new Date().toISOString()})
    on conflict (target_type, target_id)
    do update set notion_page_id = excluded.notion_page_id, updated_at = excluded.updated_at`;

  return pageId;
}
export async function getMappedNotionPage(
  database: AppDatabase,
  targetType: string,
  targetId: string,
): Promise<string | null> {
  const mapped = await database.sqlMaybe<Selected<"notion_pages", "notion_page_id">>`
    select notion_page_id from app_private.notion_pages
    where target_type = ${targetType} and target_id = ${targetId}`;
  return mapped?.notion_page_id ?? null;
}
/**
 * Puts a page in Notion's trash.
 *
 * A page that is already gone — trashed by hand, or never written — is the
 * state this asks for, so Notion refusing to touch it is the answer we wanted
 * rather than work to try again.
 */
export async function markNotionPageDeleted(pageId: string): Promise<void> {
  if (!notionEnabled()) throw new Error('notion-not-configured');
  try {
    await callNotionAPI(`/pages/${pageId}`, "PATCH", { in_trash: true });
  } catch (error) {
    if (!notionPageGone(error)) throw error;
  }
}
