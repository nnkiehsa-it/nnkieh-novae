import {
  callNotionAPI,
  dateProperty,
  ensureNumberProperty,
  ensureRichTextProperty,
  ensureSelectOption,
  numberProperty,
  richTextProperty,
  appendTimelineBlockWithDeduplication,
} from "./notion-api.ts";
import {
  appendCreationTimeline,
  getOrCreateNotionPage,
  resolveDisplayName,
  supportLabel,
  translateStatus,
} from "./notion-page.ts";
import type { NotionDomainEvent, NotionEventDatabase } from "./notion-event.ts";
import { syncSystemEventToNotion } from "./notion-system-events.ts";

/** What a proposal does to its Notion page: created, moved, answered, supported, deleted. */

export async function syncIssueEventToNotion(
  database: NotionEventDatabase,
  event: NotionDomainEvent,
): Promise<void> {
  const { event_id, event_type, aggregate_id, actor_uid, payload } = event;
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

    default:
      await syncSystemEventToNotion(database, event);
      break;
  }
}
