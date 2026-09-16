import {
  callNotionAPI,
  dateProperty,
  ensureDateProperty,
  ensureRichTextProperty,
  richTextProperty,
} from "./notion-api.ts";
import { writeNotionTimeline } from "./notion-timeline.ts";
import {
  getOrCreateNotionPage,
  resolveDisplayName,
  translateFacilityStatus,
  translateStatus,
} from "./notion-page.ts";
import type { NotionEventDatabase } from "./notion-event.ts";
import type { Selected } from "../database/schema.ts";

const ACTION_LABELS: Record<string, string> = {
  clearOperationalErrors: "清除系統錯誤紀錄",
  clearScheduledWork: "清除背景工作排程",
  completeInitialSetup: "完成平台初始設定",
  createAnnouncement: "發布公告",
  deleteAnnouncement: "刪除公告",
  deleteAnnouncementComment: "刪除公告留言",
  deleteComment: "刪除提案留言",
  deleteFacility: "刪除設備案件",
  deleteIssue: "刪除提案",
  deleteUploadedImages: "刪除圖片",
  moderateIssueStatus: "審核或更新提案狀態",
  rebuildNotionArchive: "重建 Notion 封存",
  retryOperationalWork: "重試系統工作",
  saveCategoryManagement: "更新分類設定",
  saveOperationPolicies: "更新系統執行政策",
  savePlatformFeatures: "更新平台功能",
  savePlatformSettings: "更新平台設定",
  setUserAccessScope: "更新成員負責範圍",
  saveAccountAccessRule: "儲存成員存取規則",
  deleteAccountAccessRule: "刪除成員存取規則",
  updateFacilityStatus: "更新設備案件狀態",
  updateIssueResult: "更新提案結果",
};

const DOMAIN_LABELS: Record<string, string> = {
  announcement: "公告",
  category: "分類與平台設定",
  dashboard: "系統維運",
  facility: "設備案件",
  issue: "提案",
  upload: "圖片",
  user: "成員與權限",
};

const DETAIL_LABELS: Record<string, string> = {
  announcementCommentsEnabled: "公告留言",
  announcementId: "公告 ID",
  categoryId: "分類 ID",
  commentId: "留言 ID",
  deletedFacilityCategoryIds: "刪除的設備分類",
  deletedIssueCategoryIds: "刪除的提案分類",
  durationHours: "限制時數",
  facilitiesEnabled: "設備功能",
  facilityCategories: "設備分類設定",
  facilityId: "設備案件 ID",
  id: "工作 ID",
  imageSettings: "圖片設定",
  issueCategories: "提案分類設定",
  issueId: "提案 ID",
  issuesEnabled: "提案功能",
  kind: "工作類型",
  mode: "限制方式",
  nextStatus: "新狀態",
  reason: "原因",
  message: "顯示訊息",
  preset: "存取模式",
  targetType: "規則類型",
  targetValue: "規則目標",
  retentionConfig: "資料保留設定",
  reviewRejectionReason: "審核未通過原因",
  revision: "設定版本",
  status: "狀態",
  supportDeadlineAt: "附議截止時間",
  targetUid: "成員 UID",
  uid: "成員 UID",
  values: "設定內容",
};

function detailValue(value: unknown) {
  if (typeof value === "boolean") return value ? "啟用" : "停用";
  if (Array.isArray(value)) {
    if (value.length === 0) return "無";
    if (value.length <= 5 && value.every((item) => typeof item === "string")) return value.join("、");
    return `${value.length} 項`;
  }
  if (value && typeof value === "object") return `${Object.keys(value).length} 項設定`;
  const text = String(value ?? "");
  const status = translateStatus(text);
  if (status !== text) return status;
  const facilityStatus = translateFacilityStatus(text);
  if (facilityStatus !== text) return facilityStatus;
  return ({
    "30d": "30 天",
    "7d": "7 天",
    cleanup: "外部清理待辦",
    clear: "解除限制",
    custom: "自訂期限",
    delivery: "事件投遞",
    job: "背景工作",
    permanent: "永久限制",
  } as Record<string, string>)[text] ?? text;
}

export function formatAuditDetail(detail: Record<string, unknown>) {
  const lines = Object.entries(detail)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${DETAIL_LABELS[key] ?? "其他資料"}：${detailValue(value)}`);
  return lines.length > 0 ? lines.join("\n") : "沒有附加資料";
}

type AuditNotionRecord = Selected<
  "admin_audit_log",
  "id" | "actor_uid" | "action" | "domain" | "target_id" | "detail" | "created_at"
>;

export async function rebuildAuditNotionPage(database: NotionEventDatabase, auditId: string) {
  const audit = await database.sqlMaybe<AuditNotionRecord>`select id, actor_uid, action, domain, target_id, detail, created_at
    from app_private.admin_audit_log where id = ${auditId}`;
  if (!audit) throw new Error("notion-audit-source-missing");
  const action = ACTION_LABELS[audit.action] ?? "其他系統操作";
  const domain = DOMAIN_LABELS[audit.domain] ?? "系統維運";
  const detail = formatAuditDetail((audit.detail ?? {}) as Record<string, unknown>);
  const actor = await resolveDisplayName(database, audit.actor_uid);
  const pageId = await getOrCreateNotionPage(
    database, "admin-audit", String(audit.id), `【系統維運】${action}`,
    "系統維運", "已記錄", actor, undefined, undefined, null,
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
      操作類型: richTextProperty(action),
      操作領域: richTextProperty(domain),
      "目標 ID": richTextProperty(audit.target_id),
      詳細資料: richTextProperty(detail),
    },
  });
  await writeNotionTimeline(pageId, [{
    details: detail,
    eventId: `audit:${audit.id}`,
    summary: `【系統維運】${action}，操作人：${actor}`,
  }]);
  return pageId;
}
