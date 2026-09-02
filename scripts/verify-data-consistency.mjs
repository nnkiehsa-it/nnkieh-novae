import { readFile } from "node:fs/promises";
import process from "node:process";
import pg from "pg";

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_OWNER_URL;
if (!connectionString) {
  process.stderr.write("DATABASE_URL or DATABASE_OWNER_URL is required.\n");
  process.exit(1);
}

const samplesLimit = 5;
const findings = [];

function recordFinding({ id, subsystem, severity, count, total, samples = [], detail }) {
  const normalizedCount = Number(count) || 0;
  const normalizedTotal = Number(total) || 0;
  const finding = {
    id,
    subsystem,
    severity,
    count: normalizedCount,
    total: normalizedTotal,
    ratio: normalizedTotal > 0 ? normalizedCount / normalizedTotal : 0,
    samples: samples.slice(0, samplesLimit),
    ...(detail ? { detail } : {}),
  };
  findings.push(finding);
  const state = normalizedCount === 0 ? "PASS" : severity;
  process.stdout.write(`${state.padEnd(8)} ${subsystem.padEnd(16)} ${id} ${normalizedCount}/${normalizedTotal}`);
  if (finding.samples.length > 0) process.stdout.write(` samples=${JSON.stringify(finding.samples)}`);
  if (detail) process.stdout.write(` detail=${detail}`);
  process.stdout.write("\n");
}

async function runSqlCheck(client, check) {
  try {
    const { rows } = await client.query(`
      with population as (${check.populationSql}),
      anomalies as (${check.anomalySql})
      select
        (select count(*)::bigint from population) as total,
        (select count(*)::bigint from anomalies) as count,
        coalesce((select jsonb_agg(sample_id) from (
          select sample_id from anomalies order by sample_id limit ${samplesLimit}
        ) sampled), '[]'::jsonb) as samples
    `);
    recordFinding({ ...check, ...rows[0] });
  } catch (error) {
    recordFinding({
      ...check,
      count: 1,
      total: 1,
      samples: [error instanceof Error ? error.message : String(error)],
      severity: "Critical",
      detail: "consistency query failed",
    });
  }
}

const checks = [
  {
    id: "legacy-models-removed",
    subsystem: "database",
    severity: "Critical",
    populationSql: `select unnest(array['outbox_events','idempotency_keys','push_delivery_logs','realtime_events','deletion_jobs','platform_jobs','maintenance_runs','claim_idempotency_key','complete_idempotency_key','release_idempotency_key','complete_outbox_event','fail_outbox_event','complete_realtime_event','complete_realtime_events','fail_realtime_event','fail_realtime_events','complete_push_delivery_job','fail_push_delivery_job','complete_deletion_job','fail_deletion_job']) sample_id`,
    anomalySql: `
      select tablename::text sample_id from pg_tables
      where schemaname='app_private' and tablename = any(array['outbox_events','idempotency_keys','push_delivery_logs','realtime_events','deletion_jobs','platform_jobs','maintenance_runs'])
      union all
      select proname::text from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace
      where namespace.nspname='app_api' and proname = any(array['claim_idempotency_key','complete_idempotency_key','release_idempotency_key','complete_outbox_event','fail_outbox_event','complete_realtime_event','complete_realtime_events','fail_realtime_event','fail_realtime_events','complete_push_delivery_job','fail_push_delivery_job','complete_deletion_job','fail_deletion_job'])
    `,
  },
  {
    id: "canonical-retention-settings",
    subsystem: "database",
    severity: "Critical",
    populationSql: `select generate_series(1, 28)::text sample_id`,
    anomalySql: `
      with expected(key) as (values
        ('closedIssuesEnabled'), ('closedIssuesDays'),
        ('closedFacilitiesEnabled'), ('closedFacilitiesDays'),
        ('announcementsEnabled'), ('announcementsDays'),
        ('notificationsEnabled'), ('notificationsDays'),
        ('deliveryCompletedDays'), ('deliveryFailedDays'), ('operationHours'),
        ('inactivePushTokensDays'), ('pushTokenConfirmationDays'),
        ('inactiveAvatarsEnabled'), ('inactiveAvatarsDays'),
        ('inactiveProfilePiiEnabled'), ('inactiveProfilePiiDays'),
        ('expiredRestrictionsEnabled'), ('expiredRestrictionsDays'),
        ('backgroundJobCompletedDays'), ('backgroundJobFailedDays'),
        ('roleAssignmentAuditDays'), ('adminAuditDays'),
        ('categoryConfigurationAuditDays'), ('accessAssignmentAuditDays'),
        ('pendingUploadHours'), ('unattachedUploadHours'), ('failedUploadHours')
      ), config as (
        select coalesce((
          select value::jsonb
          from app_private.runtime_settings
          where key='data_retention_settings'
        ), '{}'::jsonb) value
      ), actual as (
        select jsonb_object_keys(value) key from config
      )
      select 'missing:' || expected.key sample_id
      from expected, config
      where not config.value ? expected.key
      union all
      select 'unexpected:' || actual.key
      from actual
      where not exists(select 1 from expected where expected.key=actual.key)
    `,
  },
  {
    id: "validated-constraints",
    subsystem: "database",
    severity: "High",
    populationSql: `select conname::text sample_id from pg_constraint where connamespace in ('app_private'::regnamespace,'app_api'::regnamespace)`,
    anomalySql: `select conname::text sample_id from pg_constraint where connamespace in ('app_private'::regnamespace,'app_api'::regnamespace) and not convalidated`,
  },
  {
    id: "authoritative-foreign-keys",
    subsystem: "database",
    severity: "Critical",
    populationSql: `
      select 'issue:'||id sample_id from app_private.issues union all
      select 'facility:'||id from app_private.facility_reports union all
      select 'announcement:'||id from app_private.announcements union all
      select 'comment:'||id from app_private.comments union all
      select 'announcement-comment:'||id from app_private.announcement_comments
    `,
    anomalySql: `
      select 'issue:'||i.id sample_id from app_private.issues i left join app_private.user_profiles p on p.uid=i.author_uid left join app_private.issue_categories c on c.id=i.category where p.uid is null or c.id is null union all
      select 'facility:'||f.id from app_private.facility_reports f left join app_private.user_profiles p on p.uid=f.author_uid left join app_private.facility_categories c on c.id=f.category_id where p.uid is null or c.id is null union all
      select 'announcement:'||a.id from app_private.announcements a left join app_private.user_profiles p on p.uid=a.author_uid where p.uid is null union all
      select 'comment:'||c.id from app_private.comments c left join app_private.issues i on i.id=c.issue_id left join app_private.user_profiles p on p.uid=c.author_uid where i.id is null or p.uid is null union all
      select 'announcement-comment:'||c.id from app_private.announcement_comments c left join app_private.announcements a on a.id=c.announcement_id left join app_private.user_profiles p on p.uid=c.author_uid where a.id is null or p.uid is null
    `,
  },
  {
    id: "aggregate-counters",
    subsystem: "database",
    severity: "High",
    populationSql: `select 'issue:'||id sample_id from app_private.issues union all select 'facility:'||id from app_private.facility_reports union all select 'announcement:'||id from app_private.announcements`,
    anomalySql: `
      select 'issue:'||i.id sample_id from app_private.issues i where i.support_count <> (select count(*) from app_private.supports s where s.issue_id=i.id) or i.support_count < 0 union all
      select 'facility:'||f.id from app_private.facility_reports f where f.affected_count <> 1 + (select count(*) from app_private.facility_report_affected_users u where u.facility_id=f.id) or f.affected_count < 1 union all
      select 'announcement:'||a.id from app_private.announcements a where a.like_count <> (select count(*) from app_private.announcement_likes l where l.announcement_id=a.id) or a.comment_count <> (select count(*) from app_private.announcement_comments c where c.announcement_id=a.id) or a.like_count < 0 or a.comment_count < 0
    `,
  },
  {
    id: "aggregate-revisions",
    subsystem: "realtime-cache",
    severity: "High",
    populationSql: `select 'issue:'||id sample_id from app_private.issues union all select 'facility:'||id from app_private.facility_reports union all select 'announcement:'||id from app_private.announcements union all select 'comment:'||id from app_private.comments union all select 'announcement-comment:'||id from app_private.announcement_comments`,
    anomalySql: `select sample_id from (select 'issue:'||id sample_id,revision from app_private.issues union all select 'facility:'||id,revision from app_private.facility_reports union all select 'announcement:'||id,revision from app_private.announcements union all select 'comment:'||id,revision from app_private.comments union all select 'announcement-comment:'||id,revision from app_private.announcement_comments) revisions where revision < 1`,
  },
  {
    id: "operation-lifecycle",
    subsystem: "operations",
    severity: "High",
    populationSql: `select operation_id::text sample_id from app_private.operations`,
    anomalySql: `select operation_id::text sample_id from app_private.operations where updated_at < created_at or expires_at <= created_at or (status='processing' and updated_at < now()-interval '10 minutes') or (status='failed' and error_detail is null)`,
  },
  {
    id: "event-registry-and-correlation",
    subsystem: "events",
    severity: "Critical",
    populationSql: `select event_id::text sample_id from app_private.domain_events`,
    anomalySql: `select e.event_id::text sample_id from app_private.domain_events e left join app_private.operations o on o.operation_id=e.operation_id left join app_private.domain_event_types t on t.event_type=e.event_type where o.operation_id is null or t.event_type is null or e.aggregate_version < 1 or e.occurred_at < o.created_at`,
  },
  {
    id: "admin-audit-operation-correlation",
    subsystem: "operations",
    severity: "Critical",
    populationSql: `select id::text sample_id from app_private.admin_audit_log where operation_id is not null`,
    anomalySql: `select a.id::text sample_id from app_private.admin_audit_log a left join app_private.operations o on o.operation_id=a.operation_id left join app_private.domain_events e on e.operation_id=a.operation_id and e.event_type='admin.audit_recorded' and e.aggregate_id=a.id::text where a.operation_id is not null and (o.operation_id is null or e.event_id is null or o.actor_uid<>a.actor_uid or o.action<>a.action)`,
  },
  {
    id: "delivery-lifecycle",
    subsystem: "deliveries",
    severity: "High",
    populationSql: `select id::text sample_id from app_private.event_deliveries`,
    anomalySql: `select id::text sample_id from app_private.event_deliveries where attempt_count < 0 or updated_at < created_at or (status='processing' and (locked_at is null or locked_at < now()-interval '10 minutes')) or (status='completed' and (completed_at is null or last_attempt_id is null)) or (status='failed' and (error_detail is null or last_attempt_id is null))`,
  },
  {
    id: "background-job-lifecycle",
    subsystem: "jobs",
    severity: "High",
    populationSql: `select id::text sample_id from app_private.background_jobs`,
    anomalySql: `select id::text sample_id from app_private.background_jobs where job_type not in ('deletion','retention_cleanup','notion_reconcile','category_policy') or attempt_count < 0 or processed_rows < 0 or affected_rows < 0 or updated_at < created_at or (status='processing' and locked_at is not null and locked_at < now()-interval '10 minutes') or (status='completed' and completed_at is null) or (status='failed' and error_detail is null)`,
  },
  {
    id: "notification-recipients",
    subsystem: "notifications",
    severity: "High",
    populationSql: `select id::text sample_id from app_private.notifications`,
    anomalySql: `select n.id::text sample_id from app_private.notifications n left join app_private.user_profiles recipient on recipient.uid=n.recipient_uid where n.origin not in ('live','migration') or (n.source='broadcast' and n.recipient_uid is not null) or (n.source<>'broadcast' and n.recipient_uid is null) or (n.recipient_uid is not null and recipient.uid is null) or n.expires_at <= n.created_at`,
  },
  {
    id: "rbac-scope-integrity",
    subsystem: "rbac",
    severity: "Critical",
    populationSql: `select 'role:'||uid||':'||role_code sample_id from app_private.user_role_assignments union all select 'issue:'||uid||':'||category_id from app_private.user_issue_category_assignments union all select 'facility:'||uid||':'||category_id from app_private.user_facility_category_assignments`,
    anomalySql: `select 'role:'||a.uid||':'||a.role_code sample_id from app_private.user_role_assignments a left join app_private.user_profiles p on p.uid=a.uid left join app_private.roles r on r.code=a.role_code where p.uid is null or r.code is null union all select 'issue:'||a.uid||':'||a.category_id from app_private.user_issue_category_assignments a left join app_private.user_profiles p on p.uid=a.uid left join app_private.issue_categories c on c.id=a.category_id where p.uid is null or c.id is null union all select 'facility:'||a.uid||':'||a.category_id from app_private.user_facility_category_assignments a left join app_private.user_profiles p on p.uid=a.uid left join app_private.facility_categories c on c.id=a.category_id where p.uid is null or c.id is null`,
  },
  {
    id: "upload-authority",
    subsystem: "cloudinary",
    severity: "High",
    populationSql: `select id::text sample_id from app_private.uploads`,
    anomalySql: `select u.id::text sample_id from app_private.uploads u left join app_private.user_profiles p on p.uid=u.owner_uid where p.uid is null or (u.status='attached' and (u.attached_target_id is null or u.attached_target_type is null)) or (u.status<>'attached' and u.attached_target_id is not null) or (u.cloudinary_public_id is not null and u.status='failed' and not exists(select 1 from app_private.background_jobs j where j.job_type='deletion' and j.payload->>'cloudinary_public_id'=u.cloudinary_public_id and j.status in ('pending','processing','completed')))`,
  },
  {
    id: "notion-page-uniqueness",
    subsystem: "notion",
    severity: "High",
    populationSql: `select target_type||':'||target_id sample_id from app_private.notion_pages`,
    anomalySql: `select target_type||':'||target_id sample_id from app_private.notion_pages group by target_type,target_id having count(*)>1 union all select 'page:'||notion_page_id from app_private.notion_pages group by notion_page_id having count(*)>1`,
  },
  {
    id: "profile-coverage",
    subsystem: "firebase-profile",
    severity: "High",
    populationSql: `select uid sample_id from app_private.user_profiles`,
    anomalySql: `select referenced.uid sample_id from (select author_uid uid from app_private.issues union select author_uid from app_private.facility_reports union select author_uid from app_private.announcements union select uid from app_private.push_tokens) referenced left join app_private.user_profiles p on p.uid=referenced.uid where p.uid is null`,
  },
];

const client = new pg.Client({ connectionString });
await client.connect();
process.stdout.write("System data consistency audit\n");

try {
  for (const check of checks) await runSqlCheck(client, check);

  const responseSource = await readFile(new URL("../cloudflare/src/backend/actions/response.ts", import.meta.url), "utf8");
  recordFinding({
    id: "api-operation-envelope",
    subsystem: "api-contract",
    severity: "Critical",
    count: responseSource.includes("requestId") || !responseSource.includes("operationId") ? 1 : 0,
    total: 1,
    samples: responseSource.includes("requestId") ? ["requestId"] : [],
  });

  const eventSource = await readFile(new URL("../cloudflare/src/backend/events/domain-events.ts", import.meta.url), "utf8");
  const eventBlock = eventSource.match(/DOMAIN_EVENT_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/u)?.[1] ?? "";
  const workerEvents = [...eventBlock.matchAll(/"([a-z0-9_.-]+)"/gu)].map((match) => match[1]).sort();
  const { rows: eventRows } = await client.query("select event_type from app_private.domain_event_types order by event_type");
  const databaseEvents = eventRows.map((row) => row.event_type);
  const eventDrift = [...new Set([...workerEvents, ...databaseEvents])]
    .filter((eventType) => workerEvents.includes(eventType) !== databaseEvents.includes(eventType));
  recordFinding({
    id: "event-registry-drift",
    subsystem: "events",
    severity: "Critical",
    count: eventDrift.length,
    total: databaseEvents.length,
    samples: eventDrift,
  });

  const cacheSource = await readFile(new URL("../src/lib/persistent-cache.ts", import.meta.url), "utf8");
  recordFinding({
    id: "browser-cache-namespace",
    subsystem: "realtime-cache",
    severity: "High",
    count: cacheSource.includes("novae-content-cache-v5") && cacheSource.includes("novae-content-cache-v4") ? 0 : 1,
    total: 1,
    samples: ["expected v5 active and v4 retired"],
  });

  if (process.env.NOTION_API_BASE_URL) {
    try {
      const response = await fetch(`${process.env.NOTION_API_BASE_URL.replace(/\/$/u, "")}/__requests`);
      const state = response.ok ? await response.json() : null;
      const pages = state && typeof state === "object" && state.notionPages && typeof state.notionPages === "object"
        ? Object.values(state.notionPages)
        : [];
      const seen = new Set();
      const duplicates = [];
      for (const page of pages) {
        const novaeId = page?.properties?.["Novae ID"]?.rich_text?.[0]?.text?.content;
        if (!novaeId) continue;
        if (seen.has(novaeId)) duplicates.push(String(novaeId));
        seen.add(novaeId);
      }
      recordFinding({ id: "notion-provider-novae-id", subsystem: "notion", severity: "High", count: duplicates.length, total: pages.length, samples: duplicates });
    } catch (error) {
      recordFinding({ id: "notion-provider-reachable", subsystem: "notion", severity: "Medium", count: 1, total: 1, samples: [error instanceof Error ? error.message : String(error)] });
    }
  }
} finally {
  await client.end();
}

const blocking = findings.filter((finding) => finding.count > 0 && (finding.severity === "Critical" || finding.severity === "High"));
process.stdout.write(`${JSON.stringify({ checks: findings.length, blocking: blocking.length, findings }, null, 2)}\n`);
process.exit(blocking.length > 0 ? 1 : 0);
