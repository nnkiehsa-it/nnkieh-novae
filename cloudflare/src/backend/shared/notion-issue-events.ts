import {
  appendTimelineBlockWithDeduplication,
  callNotionAPI,
  dateProperty,
  ensureDateProperty,
  ensureNumberProperty,
  ensureRichTextProperty,
  ensureSelectOption,
  numberProperty,
  richTextProperty,
} from "./notion-api.ts";
import {
  appendCreationTimeline,
  getMappedNotionPage,
  getOrCreateNotionPage,
  resolveDisplayName,
  supportLabel,
  translateStatus,
} from "./notion-page.ts";
import type { NotionDomainEvent, NotionEventDatabase } from "./notion-event.ts";
import type { Selected } from "../database/schema.ts";

type IssueNotionRecord = Selected<
  "issues",
  "id" | "title" | "content" | "category" | "status" | "author_uid"
  | "support_count" | "support_goal" | "created_at" | "review_approved_at"
  | "support_deadline_at" | "support_met_at" | "response_deadline_at" | "closed_at"
  | "review_rejection_reason" | "result_content"
>;

async function readIssue(database: NotionEventDatabase, issueId: string) {
  return database.sqlMaybe<IssueNotionRecord>`select id, title, content, category, status, author_uid,
    support_count, support_goal, created_at, review_approved_at, support_deadline_at,
    support_met_at, response_deadline_at, closed_at, review_rejection_reason, result_content
    from app_private.issues where id = ${issueId}`;
}

async function ensureIssuePage(database: NotionEventDatabase, issue: IssueNotionRecord) {
  const pageId = await getOrCreateNotionPage(
    database,
    "issue",
    issue.id,
    issue.title,
    issue.category,
    issue.status,
    await resolveDisplayName(database, issue.author_uid),
    issue.support_count,
    issue.support_goal,
  );
  if (!pageId) throw new Error("notion-issue-page-missing");

  await Promise.all([
    ensureDateProperty("建立時間"),
    ensureDateProperty("審核通過時間"),
    ensureDateProperty("附議截止時間"),
    ensureDateProperty("附議達標時間"),
    ensureDateProperty("回覆期限"),
    ensureDateProperty("結案時間"),
    ensureNumberProperty("附議數量"),
    ensureNumberProperty("附議門檻"),
    ensureRichTextProperty("審核未通過原因"),
    ensureRichTextProperty("提案結果"),
    ensureSelectOption("狀態", translateStatus(issue.status)),
  ]);
  await callNotionAPI(`/pages/${pageId}`, "PATCH", {
    properties: {
      狀態: { select: { name: translateStatus(issue.status) } },
      建立時間: dateProperty(issue.created_at),
      審核通過時間: dateProperty(issue.review_approved_at),
      附議截止時間: dateProperty(issue.support_deadline_at),
      附議達標時間: dateProperty(issue.support_met_at),
      回覆期限: dateProperty(issue.response_deadline_at),
      結案時間: dateProperty(issue.closed_at),
      附議數: richTextProperty(supportLabel(issue.support_count, issue.support_goal)),
      附議數量: numberProperty(issue.support_count),
      附議門檻: numberProperty(issue.support_goal),
      審核未通過原因: richTextProperty(issue.review_rejection_reason),
      提案結果: richTextProperty(issue.result_content),
    },
  });
  return pageId;
}

async function appendIssueComment(
  database: NotionEventDatabase,
  pageId: string,
  marker: string,
  authorUid: string,
  content: string,
) {
  await appendTimelineBlockWithDeduplication(
    pageId,
    marker,
    `【提案留言】${await resolveDisplayName(database, authorUid)}`,
    content,
  );
}

export async function rebuildIssueNotionPage(database: NotionEventDatabase, issueId: string) {
  const issue = await readIssue(database, issueId);
  if (!issue) throw new Error("notion-issue-source-missing");
  const pageId = await ensureIssuePage(database, issue);
  await appendCreationTimeline(
    database,
    pageId,
    `rebuild:issue:${issue.id}`,
    `【提案內容】${issue.title}`,
    issue.content,
  );
  const { rows: comments } = await database.sql<Selected<
    "comments",
    "id" | "author_uid" | "content" | "created_at"
  >>`select id, author_uid, content, created_at from app_private.comments
    where issue_id = ${issue.id} order by created_at, id`;
  for (const comment of comments) {
    await appendIssueComment(
      database,
      pageId,
      `rebuild:issue-comment:${comment.id}`,
      comment.author_uid,
      comment.content,
    );
  }
  return pageId;
}

/** Keeps one proposal page complete as its state and discussion change. */
export async function syncIssueEventToNotion(
  database: NotionEventDatabase,
  event: NotionDomainEvent,
): Promise<void> {
  const { event_id, event_type, aggregate_id, actor_uid, payload } = event;
  if (event_type === "issue.deleted") {
    const pageId = await getMappedNotionPage(database, "issue", aggregate_id);
    if (!pageId) return;
    await ensureSelectOption("狀態", "已刪除");
    await callNotionAPI(`/pages/${pageId}`, "PATCH", {
      properties: { 狀態: { select: { name: "已刪除" } } },
    });
    await appendTimelineBlockWithDeduplication(pageId, event_id, "【提案刪除】此提案已自 Novae 刪除");
    return;
  }

  const issue = await readIssue(database, aggregate_id);
  if (!issue) throw new Error("notion-issue-source-missing");
  const pageId = await ensureIssuePage(database, issue);

  switch (event_type) {
    case "issue.created":
      await appendCreationTimeline(database, pageId, event_id, `【提案建立】${issue.title}`, issue.content);
      return;
    case "issue.status_changed": {
      const status = translateStatus(issue.status);
      const details = issue.review_rejection_reason
        ? `審核未通過原因：${issue.review_rejection_reason}`
        : issue.result_content
          ? `處理結果：${issue.result_content}`
          : undefined;
      await appendTimelineBlockWithDeduplication(pageId, event_id, `【狀態變更】${status}`, details);
      return;
    }
    case "issue.result_updated":
      await appendTimelineBlockWithDeduplication(pageId, event_id, "【提案結果更新】", issue.result_content ?? undefined);
      return;
    case "support.goal_met":
      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        `【附議達標】目前附議數：${supportLabel(issue.support_count, issue.support_goal)}`,
      );
      return;
    case "support.toggled":
      return;
    case "issue.comment_created":
      await appendIssueComment(database, pageId, event_id, actor_uid, String(payload.content ?? ""));
      return;
    case "issue.comment_deleted":
      await appendTimelineBlockWithDeduplication(
        pageId,
        event_id,
        "【提案留言刪除】一則留言已自 Novae 刪除",
      );
      return;
    default:
      throw new Error(`unsupported-notion-issue-event:${event_type}`);
  }
}
