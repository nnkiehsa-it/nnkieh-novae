import { asRecord, asString } from "../_shared/http.ts";
import { ISSUE_CATEGORIES } from "../_shared/issue-categories.ts";
import type { BackendSupabase, JsonRecord } from "./types.ts";
import { latestDateMs, toMs } from "./utils.ts";

const NOTION_EVENT_TYPES = [
  "issue.created",
  "issue.status_changed",
  "issue.comment_created",
  "support.created",
  "support.deleted",
  "support.goal_met",
  "issue.deleted",
  "announcement.created",
  "announcement.updated",
  "announcement.deleted",
];

export async function getPlatformDashboard(supabase: BackendSupabase) {
  const [
    { count: userCount },
    { count: issueCount },
    { count: commentCount },
    { count: supportCount },
    { count: outboxFailed },
    { count: outboxPending },
    { count: notionFailed },
    { count: notionPending },
    { count: pushFailed },
    { count: uploadPending },
    { count: deletionPending },
    { data: oldestPendingSync },
    { data: latestMaintenanceRun },
    { data: recentOutboxFailures },
    { data: recentPushFailures },
    { data: issueCategories },
    { data: commentCategories },
  ] = await Promise.all([
    supabase.schema("app_private").from("user_profiles").select("*", { count: "exact", head: true }),
    supabase.schema("app_private").from("issues").select("*", { count: "exact", head: true }),
    supabase.schema("app_private").from("comments").select("*", { count: "exact", head: true }),
    supabase.schema("app_private").from("supports").select("*", { count: "exact", head: true }),
    supabase.schema("app_private").from("outbox_events").select("*", { count: "exact", head: true }).eq("status", "failed"),
    supabase.schema("app_private").from("outbox_events").select("*", { count: "exact", head: true }).in("status", ["pending", "processing"]),
    supabase.schema("app_private").from("outbox_events").select("*", { count: "exact", head: true }).eq("status", "failed").in("event_type", NOTION_EVENT_TYPES),
    supabase.schema("app_private").from("outbox_events").select("*", { count: "exact", head: true }).in("status", ["pending", "processing"]).in("event_type", NOTION_EVENT_TYPES),
    supabase.schema("app_private").from("push_delivery_logs").select("*", { count: "exact", head: true }).eq("status", "failed"),
    supabase.schema("app_private").from("uploads").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.schema("app_private").from("deletion_jobs").select("*", { count: "exact", head: true }).in("status", ["pending", "failed"]),
    supabase.schema("app_private").from("outbox_events").select("created_at").in("status", ["pending", "processing"]).in("event_type", NOTION_EVENT_TYPES).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    supabase.schema("app_private").from("maintenance_runs").select("status,started_at,completed_at,error,details").eq("task_name", "maintenance.cleanup").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.schema("app_private").from("outbox_events").select("id,event_type,status,last_error,updated_at").eq("status", "failed").order("updated_at", { ascending: false }).limit(5),
    supabase.schema("app_private").from("push_delivery_logs").select("id,status,error_message,updated_at").eq("status", "failed").order("updated_at", { ascending: false }).limit(5),
    supabase.schema("app_private").from("issues").select("category,created_at,updated_at").limit(10000),
    supabase.schema("app_private").from("comments").select("issue:issues(category),created_at,updated_at").limit(10000),
  ]);

  const issuesByCategory: Record<string, number> = Object.fromEntries(ISSUE_CATEGORIES.map((category) => [category.id, 0]));
  for (const row of issueCategories ?? []) {
    const category = asString((row as JsonRecord).category);
    if (!category) continue;
    issuesByCategory[category] = (issuesByCategory[category] ?? 0) + 1;
  }

  const commentsByCategory: Record<string, number> = Object.fromEntries(ISSUE_CATEGORIES.map((category) => [category.id, 0]));
  for (const row of commentCategories ?? []) {
    const issue = asRecord((row as JsonRecord).issue);
    const category = asString(issue.category);
    if (!category) continue;
    commentsByCategory[category] = (commentsByCategory[category] ?? 0) + 1;
  }

  const lastActivityAtMs = Math.max(
    latestDateMs((issueCategories ?? []) as Array<{ created_at?: unknown; updated_at?: unknown }>),
    latestDateMs((commentCategories ?? []) as Array<{ created_at?: unknown; updated_at?: unknown }>),
    Date.now(),
  );
  const recentFailures = [
    ...(recentOutboxFailures ?? []).map((failure) => ({
      id: failure.id,
      message: failure.last_error ?? "",
      source: NOTION_EVENT_TYPES.includes(String(failure.event_type)) ? "notion" : "outbox",
      status: failure.status,
      updated_at_ms: toMs(failure.updated_at),
    })),
    ...(recentPushFailures ?? []).map((failure) => ({
      id: failure.id,
      message: failure.error_message ?? "",
      source: "push",
      status: failure.status,
      updated_at_ms: toMs(failure.updated_at),
    })),
  ].sort((left, right) => (right.updated_at_ms ?? 0) - (left.updated_at_ms ?? 0)).slice(0, 8);
  const maintenanceDetails = asRecord(latestMaintenanceRun?.details);
  const failedMaintenanceTasks = [];
  if (Number(maintenanceDetails.failed_deletion_jobs_too_old ?? 0) > 0) {
    failedMaintenanceTasks.push("刪除工作失敗過久");
  }
  const overallStatus = (outboxFailed ?? 0) > 0 || (pushFailed ?? 0) > 0
    ? "critical"
    : (outboxPending ?? 0) > 0 || (deletionPending ?? 0) > 0 || (uploadPending ?? 0) > 0
      ? "attention"
      : "healthy";

  return {
    stats: {
      comments_by_category: commentsByCategory,
      issues_by_category: issuesByCategory,
      last_activity_at_ms: lastActivityAtMs,
      total_comments_created: commentCount ?? 0,
      total_comments_deleted: 0,
      total_issues_created: issueCount ?? 0,
      total_issues_deleted: 0,
      total_supports_added: supportCount ?? 0,
      total_supports_removed: 0,
      total_users_seen: userCount ?? 0,
      updated_at_ms: Date.now(),
    },
    operations: {
      cleanup_backlog_capped: false,
      cleanup_backlog_count: deletionPending ?? 0,
      failed_notion_sync_capped: (notionFailed ?? 0) >= 1000,
      failed_notion_sync_count: notionFailed ?? 0,
      failed_outbox_capped: false,
      failed_outbox_count: outboxFailed ?? 0,
      failed_push_delivery_capped: (pushFailed ?? 0) >= 1000,
      failed_push_delivery_count: pushFailed ?? 0,
      next_sync_count: notionPending ?? 0,
      oldest_pending_sync_at_ms: toMs(oldestPendingSync?.created_at),
      overall_status: overallStatus,
      pending_notion_sync_capped: false,
      pending_notion_sync_count: notionPending ?? 0,
      recent_failures: recentFailures,
      scheduled_maintenance: {
        completed_at_ms: toMs(latestMaintenanceRun?.completed_at),
        error: latestMaintenanceRun?.error ?? "",
        failed_tasks: failedMaintenanceTasks,
        started_at_ms: toMs(latestMaintenanceRun?.started_at),
        status: latestMaintenanceRun?.status ?? "idle",
        updated_at_ms: toMs(latestMaintenanceRun?.completed_at ?? latestMaintenanceRun?.started_at),
      },
      stuck_upload_capped: false,
      stuck_upload_count: uploadPending ?? 0,
    },
  };
}
