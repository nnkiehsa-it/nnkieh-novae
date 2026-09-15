#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

EXPECTED_HEAD = "aebd065e2b980df3c1ddd89ddb97ff7d9573955f"


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    old_count = text.count(old)
    new_count = text.count(new)
    # Many replacements intentionally keep the old anchor as a prefix of the
    # new block. Check the full replacement first or resumed runs will append
    # the same block again every time.
    if new and new_count == 1:
        return
    if old_count == 1:
        path.write_text(text.replace(old, new, 1), encoding="utf-8")
        return
    raise RuntimeError(
        f"{path}: expected one source anchor or one already-applied replacement; "
        f"found old={old_count}, new={new_count}\nANCHOR:\n{old[:500]}"
    )


def remove_once(path: Path, old: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count == 1:
        path.write_text(text.replace(old, "", 1), encoding="utf-8")
        return
    # Resumable: a previous run may already have removed this exact line.
    if count == 0:
        return
    raise RuntimeError(
        f"{path}: expected at most one removable anchor; found {count}\nANCHOR:\n{old[:500]}"
    )


def append_once(path: Path, marker: str, addition: str) -> None:
    text = path.read_text(encoding="utf-8")
    if marker in text:
        return
    path.write_text(text.rstrip() + "\n\n" + addition.strip() + "\n", encoding="utf-8")


def run(*args: str) -> None:
    subprocess.run(args, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply Novae system-console recovery fix (resumable v3)")
    parser.add_argument("--allow-newer-head", action="store_true", help="skip exact HEAD guard; exact source anchors still have to match")
    parser.add_argument("--verify", action="store_true", help="run verify:fast and verify:integration after generation")
    args = parser.parse_args()

    root = Path.cwd()
    if not (root / "AGENTS.md").exists() or not (root / "cloudflare").exists():
        raise SystemExit("Run this from the tavricccc/novae repository root.")

    head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    if head != EXPECTED_HEAD and not args.allow_newer_head:
        raise SystemExit(
            f"Expected HEAD {EXPECTED_HEAD}, got {head}. Pull latest and review the newer diff, "
            "or rerun with --allow-newer-head only if the exact anchors still match."
        )

    # 1. Backend: a rebuild is a replacement, not a request to reuse a legacy job.
    p = root / "cloudflare/src/backend/actions/operations.ts"
    replace_once(
        p,
        """  if (action === 'rebuildNotionArchive') {\n    if (!notionEnabled()) throw new Error('service-not-configured');\n    const queued = await database.sqlOne<{ already_queued: boolean; id: string }>`\n      with existing as (\n        select id from app_private.background_jobs\n        where job_type = 'notion_reconcile' and status in ('pending', 'processing')\n        order by created_at desc limit 1\n      ), inserted as (\n        insert into app_private.background_jobs (job_type, scope_id, payload, created_by)\n        select 'notion_reconcile', 'global', ${JSON.stringify({ schemaVersion: 2 })}::jsonb, ${auth.uid}\n        where not exists (select 1 from existing)\n        returning id\n      )\n      select id, false as already_queued from inserted\n      union all\n      select id, true as already_queued from existing\n      limit 1`;\n    const cleared = queued.already_queued ? null : await clearSupersededNotionWork(queued.id, database);\n    return { alreadyQueued: queued.already_queued, cleared, jobId: queued.id, success: true };\n  }\n""",
        """  if (action === 'rebuildNotionArchive') {\n    if (!notionEnabled()) throw new Error('service-not-configured');\n    // Two administrators asking at the same instant still leave exactly one fresh rebuild.\n    await database.sql`select pg_advisory_xact_lock(hashtext('novae:notion-rebuild'))`;\n    const cleared = await clearSupersededNotionWork(database);\n    const queued = await database.sqlOne<{ id: string }>`\n      insert into app_private.background_jobs (job_type, scope_id, payload, created_by)\n      values ('notion_reconcile', 'global', ${JSON.stringify({ schemaVersion: 2 })}::jsonb, ${auth.uid})\n      returning id`;\n    return { cleared, jobId: queued.id, success: true };\n  }\n  if (action === 'clearOperationalErrors') {\n    const errors = await database.sql`delete from app_private.operational_errors returning bucket`;\n    return { cleared: errors.rows.length, success: true };\n  }\n  if (action === 'clearScheduledWork') {\n    const jobs = await database.sql`update app_private.background_jobs\n      set status = 'superseded', locked_at = null, updated_at = now()\n      where status in ('pending', 'processing', 'failed') returning id`;\n    const cleanup = await database.sql`delete from app_private.external_cleanup_backlog returning job_id`;\n    return {\n      cleanup: cleanup.rows.length,\n      cleared: jobs.rows.length + cleanup.rows.length,\n      jobs: jobs.rows.length,\n      success: true,\n    };\n  }\n""",
    )
    replace_once(
        p,
        """/**\n * Everything about the old archive, cleared the moment a rebuild is asked for.\n *\n * A rebuild states the archive from the canonical record, so a Notion delivery\n * still waiting describes a page this job writes again anyway, a failed one\n * describes a page it is about to replace, and the mappings name the pages an\n * administrator removed by hand before asking for this. Earlier rebuilds are\n * cleared with them: a rebuild that stopped is superseded by this one, and\n * leaving its failure on the operations screen meant the screen reported a\n * problem that no longer existed and could never be retried away.\n *\n * This happens when the administrator asks rather than when the job is first\n * claimed, so the screen they are looking at is right immediately instead of\n * at the next sweep. Only Notion's queue is touched: a push or in-app\n * notification still waiting has nothing to do with the archive.\n */\nasync function clearSupersededNotionWork(jobId: string, database: BackendDatabase) {\n  const deliveries = await database.sql`delete from app_private.event_deliveries\n    where destination = 'notion' and status in ('pending', 'failed') returning id`;\n  const jobs = await database.sql`delete from app_private.background_jobs\n    where job_type = 'notion_reconcile' and id <> ${jobId}::uuid returning id`;\n  const mappings = await database.sql`delete from app_private.notion_pages returning target_id`;\n  return {\n    deliveries: deliveries.rows.length,\n    jobs: jobs.rows.length,\n    mappings: mappings.rows.length,\n  };\n}\n""",
        """/**\n * Everything the new archive replaces, retired before its fresh job is queued.\n *\n * Rebuilds are replacement operations, not retries. Waiting, running and failed\n * Notion deliveries describe pages this rebuild writes again. Previous rebuild\n * jobs and Notion-only deletion work are fenced as superseded, so an in-flight\n * legacy worker cannot write its status back after the new rebuild starts.\n * Cloudinary deletion work and every non-Notion delivery remain untouched.\n */\nasync function clearSupersededNotionWork(database: BackendDatabase) {\n  const deliveries = await database.sql`delete from app_private.event_deliveries\n    where destination = 'notion' and status in ('pending', 'processing', 'failed') returning id`;\n  const rebuildJobs = await database.sql`update app_private.background_jobs\n    set status = 'superseded', locked_at = null, updated_at = now()\n    where job_type = 'notion_reconcile' and status in ('pending', 'processing', 'failed') returning id`;\n  const deletionJobs = await database.sql`update app_private.background_jobs\n    set status = 'superseded', locked_at = null, updated_at = now()\n    where job_type = 'deletion' and status in ('pending', 'processing', 'failed')\n      and nullif(payload->>'notion_page_id', '') is not null\n      and nullif(payload->>'cloudinary_public_id', '') is null\n    returning id`;\n  const cleanup = await database.sql`delete from app_private.external_cleanup_backlog\n    where nullif(payload->>'notion_page_id', '') is not null\n      and nullif(payload->>'cloudinary_public_id', '') is null\n    returning job_id`;\n  const mappings = await database.sql`delete from app_private.notion_pages returning target_id`;\n  return {\n    cleanup: cleanup.rows.length,\n    deliveries: deliveries.rows.length,\n    jobs: rebuildJobs.rows.length + deletionJobs.rows.length,\n    mappings: mappings.rows.length,\n  };\n}\n""",
    )

    # 2. Register both destructive maintenance actions and their rate limits.
    p = root / "config/backend-actions.config.json"
    replace_once(
        p,
        '  "rebuildNotionArchive": { "group": "admin-write", "extraLimit": "destructiveWriteHourly" },\n  "retryOperationalWork":',
        '  "rebuildNotionArchive": { "group": "admin-write", "extraLimit": "destructiveWriteHourly" },\n  "clearOperationalErrors": { "group": "admin-write", "extraLimit": "destructiveWriteHourly" },\n  "clearScheduledWork": { "group": "admin-write", "extraLimit": "destructiveWriteHourly" },\n  "retryOperationalWork":',
    )

    p = root / "cloudflare/src/backend/actions/action-registry.ts"
    replace_once(
        p,
        '  action("rebuildNotionArchive", "dashboard", "admin-write", handleOperationsAction, { requiredPermission: "role.manage" }),\n  action("retryOperationalWork",',
        '  action("rebuildNotionArchive", "dashboard", "admin-write", handleOperationsAction, { requiredPermission: "role.manage" }),\n  action("clearOperationalErrors", "dashboard", "admin-write", handleOperationsAction, { requiredPermission: "role.manage" }),\n  action("clearScheduledWork", "dashboard", "admin-write", handleOperationsAction, { requiredPermission: "role.manage" }),\n  action("retryOperationalWork",',
    )

    p = root / "cloudflare/src/backend/events/platform-events.ts"
    replace_once(
        p,
        '    case "rebuildNotionArchive":\n      return [];',
        '    case "clearOperationalErrors":\n    case "clearScheduledWork":\n    case "rebuildNotionArchive":\n      return [];',
    )

    p = root / "cloudflare/src/backend/shared/notion-audit-events.ts"
    replace_once(
        p,
        '  completeInitialSetup: "完成平台初始設定",\n  createAnnouncement:',
        '  clearOperationalErrors: "清除系統錯誤紀錄",\n  clearScheduledWork: "清除背景工作排程",\n  completeInitialSetup: "完成平台初始設定",\n  createAnnouncement:',
    )

    # 3. Client service contract and hook behavior.
    p = root / "src/services/operations-console.ts"
    replace_once(
        p,
        """export const retryOperationalWork = invokeBackendAction<\n  { kind: 'job' | 'delivery' | 'cleanup' | 'all'; id?: string },\n  { success: boolean; retried?: number }\n>('retryOperationalWork');\nexport const queueNotionArchiveRebuild = invokeBackendAction<Record<string, never>, {\n  alreadyQueued: boolean;\n  /** What the request swept away, or null when a rebuild was already running. */\n  cleared: { deliveries: number; jobs: number; mappings: number } | null;\n  jobId: string;\n  success: boolean;\n}>('rebuildNotionArchive');\n""",
        """export const clearOperationalErrors = invokeBackendAction<Record<string, never>, {\n  cleared: number;\n  success: boolean;\n}>('clearOperationalErrors');\nexport const clearScheduledWork = invokeBackendAction<Record<string, never>, {\n  cleanup: number;\n  cleared: number;\n  jobs: number;\n  success: boolean;\n}>('clearScheduledWork');\nexport const retryOperationalWork = invokeBackendAction<\n  { kind: 'job' | 'delivery' | 'cleanup' | 'all'; id?: string },\n  { success: boolean; retried?: number }\n>('retryOperationalWork');\nexport const queueNotionArchiveRebuild = invokeBackendAction<Record<string, never>, {\n  cleared: { cleanup: number; deliveries: number; jobs: number; mappings: number };\n  jobId: string;\n  success: boolean;\n}>('rebuildNotionArchive');\n""",
    )

    p = root / "src/hooks/use-system-console.ts"
    replace_once(
        p,
        """import {\n  fetchOperationsConsole,\n  queueNotionArchiveRebuild,\n  retryOperationalWork,\n  type OperationsConsole,\n} from \"@/services/operations-console\";\n""",
        """import {\n  clearOperationalErrors,\n  clearScheduledWork,\n  fetchOperationsConsole,\n  queueNotionArchiveRebuild,\n  retryOperationalWork,\n  type OperationsConsole,\n} from \"@/services/operations-console\";\n""",
    )
    replace_once(
        p,
        '  const [retrying, setRetrying] = React.useState("");\n  const [rebuildingNotion, setRebuildingNotion] = React.useState(false);',
        '  const [retrying, setRetrying] = React.useState("");\n  const [clearing, setClearing] = React.useState<"errors" | "schedules" | "">("");\n  const [rebuildingNotion, setRebuildingNotion] = React.useState(false);',
    )
    replace_once(
        p,
        """  const rebuildNotion = React.useCallback(async () => {\n    setRebuildingNotion(true);\n    try {\n      const result = await queueNotionArchiveRebuild({});\n      const cleared = result.cleared;\n      toast.success(result.alreadyQueued || !cleared\n        ? t(\"ui.operations.notionRebuildAlreadyQueued\")\n        : t(\"ui.operations.notionRebuildQueued\", {\n          cleared: cleared.deliveries + cleared.jobs + cleared.mappings,\n        }));\n      await load(0);\n    } catch (caught) {\n      toast.error(caught instanceof Error ? caught.message : t(\"ui.operations.notionRebuildFailed\"));\n    } finally {\n      setRebuildingNotion(false);\n    }\n  }, [load, t]);\n\n  return {\n""",
        """  const clearErrors = React.useCallback(async () => {\n    setClearing(\"errors\");\n    try {\n      const result = await clearOperationalErrors({});\n      toast.success(t(\"admin.clearErrorsDone\", { count: result.cleared }));\n      await load(value.page);\n    } catch (caught) {\n      toast.error(caught instanceof Error ? caught.message : t(\"ui.common.operationFailed\"));\n    } finally {\n      setClearing(\"\");\n    }\n  }, [load, t, value.page]);\n\n  const clearSchedules = React.useCallback(async () => {\n    setClearing(\"schedules\");\n    try {\n      const result = await clearScheduledWork({});\n      toast.success(t(\"admin.clearSchedulesDone\", { count: result.cleared }));\n      await load(value.page);\n    } catch (caught) {\n      toast.error(caught instanceof Error ? caught.message : t(\"ui.common.operationFailed\"));\n    } finally {\n      setClearing(\"\");\n    }\n  }, [load, t, value.page]);\n\n  const rebuildNotion = React.useCallback(async () => {\n    setRebuildingNotion(true);\n    try {\n      const result = await queueNotionArchiveRebuild({});\n      const cleared = result.cleared;\n      toast.success(t(\"ui.operations.notionRebuildQueued\", {\n        cleared: cleared.cleanup + cleared.deliveries + cleared.jobs + cleared.mappings,\n      }));\n      await load(0);\n    } catch (caught) {\n      toast.error(caught instanceof Error ? caught.message : t(\"ui.operations.notionRebuildFailed\"));\n    } finally {\n      setRebuildingNotion(false);\n    }\n  }, [load, t]);\n\n  return {\n    clearErrors,\n    clearSchedules,\n    clearing,\n""",
    )

    # 4. Rebuild remains available while a legacy/stuck rebuild is visible.
    p = root / "src/components/admin/notion-rebuild-action.tsx"
    remove_once(p, '              disabled={Boolean(job)}\n')

    # 5. Wire the destructive controls into the system screen.
    p = root / "src/components/admin/system-console.tsx"
    replace_once(
        p,
        """  const { error, load, loading, notionJob, page, rebuildNotion, rebuildingNotion, retry, retryAll, retrying, snapshot } =\n    useSystemConsole();\n""",
        """  const {\n    clearErrors, clearSchedules, clearing, error, load, loading, notionJob, page, rebuildNotion,\n    rebuildingNotion, retry, retryAll, retrying, snapshot,\n  } = useSystemConsole();\n""",
    )
    replace_once(
        p,
        """              <SystemQueue\n                onRetry={retry}\n                onRetryAll={() => void retryAll()}\n                retrying={retrying}\n                snapshot={snapshot}\n              />\n""",
        """              <SystemQueue\n                clearing={clearing}\n                onClearErrors={() => void clearErrors()}\n                onClearSchedules={() => void clearSchedules()}\n                onRetry={retry}\n                onRetryAll={() => void retryAll()}\n                retrying={retrying}\n                snapshot={snapshot}\n              />\n""",
    )

    p = root / "src/components/admin/system-queue.tsx"
    replace_once(
        p,
        'import { AnimatePresence, motion } from "motion/react";\nimport { ListRestart } from "lucide-react";',
        'import { AnimatePresence, motion } from "motion/react";\nimport { ListRestart } from "lucide-react";\n\nimport {\n  AlertDialog,\n  AlertDialogAction,\n  AlertDialogCancel,\n  AlertDialogContent,\n  AlertDialogDescription,\n  AlertDialogFooter,\n  AlertDialogHeader,\n  AlertDialogTitle,\n} from "@/components/ui/alert-dialog";',
    )
    replace_once(
        p,
        """export function SystemQueue({\n  onRetry,\n  onRetryAll,\n  retrying,\n  snapshot,\n}: {\n  onRetry: (kind: RetryKind, id: string) => void;\n  onRetryAll: () => void;\n  retrying: string;\n  snapshot: Partial<OperationsConsole>;\n}) {\n""",
        """export function SystemQueue({\n  clearing,\n  onClearErrors,\n  onClearSchedules,\n  onRetry,\n  onRetryAll,\n  retrying,\n  snapshot,\n}: {\n  clearing: \"errors\" | \"schedules\" | \"\";\n  onClearErrors: () => void;\n  onClearSchedules: () => void;\n  onRetry: (kind: RetryKind, id: string) => void;\n  onRetryAll: () => void;\n  retrying: string;\n  snapshot: Partial<OperationsConsole>;\n}) {\n""",
    )
    replace_once(
        p,
        """  const { t } = useI18n();\n  const [opened, setOpened] = React.useState<FailureItem | null>(null);\n  const { cleanupBacklog, deliveries, errors, failedDeliveries, jobs } = snapshot;\n""",
        """  const { t } = useI18n();\n  const [opened, setOpened] = React.useState<FailureItem | null>(null);\n  const [clearKind, setClearKind] = React.useState<\"errors\" | \"schedules\" | null>(null);\n  const { cleanupBacklog, deliveries, errors, failedDeliveries, jobs } = snapshot;\n""",
    )
    replace_once(
        p,
        """  const everythingRead = Boolean(jobs && failedDeliveries && cleanupBacklog && errors);\n\n  return (\n""",
        """  const everythingRead = Boolean(jobs && failedDeliveries && cleanupBacklog && errors);\n  const clearTitle = clearKind === \"errors\"\n    ? t(\"admin.clearErrorsTitle\")\n    : t(\"admin.clearSchedulesTitle\");\n  const clearDescription = clearKind === \"errors\"\n    ? t(\"admin.clearErrorsDescription\")\n    : t(\"admin.clearSchedulesDescription\");\n  const clearLabel = clearKind === \"errors\"\n    ? t(\"admin.clearErrors\")\n    : t(\"admin.clearSchedules\");\n\n  return (\n""",
    )
    replace_once(
        p,
        """        {recorded.length > 0 ? (\n          <Panel key=\"errors\">\n            <ListSection header={t(\"ui.operations.errors\")}>\n              {recorded.map((item) => (\n                <FailureRow\n                  item={item}\n                  key={item.id}\n                  onOpen={() => setOpened(item)}\n                  onRetry={() => undefined}\n                  retrying={false}\n                />\n              ))}\n            </ListSection>\n          </Panel>\n        ) : null}\n      </AnimatePresence>\n\n      <FailureDetailSheet\n""",
        """        {recorded.length > 0 ? (\n          <Panel key=\"errors\">\n            <ListSection header={t(\"ui.operations.errors\")}>\n              {recorded.map((item) => (\n                <FailureRow\n                  item={item}\n                  key={item.id}\n                  onOpen={() => setOpened(item)}\n                  onRetry={() => undefined}\n                  retrying={false}\n                />\n              ))}\n            </ListSection>\n          </Panel>\n        ) : null}\n      </AnimatePresence>\n\n      {everythingRead ? (\n        <div className=\"flex flex-wrap justify-end gap-2\">\n          <Button\n            disabled={Boolean(clearing)}\n            onClick={() => setClearKind(\"schedules\")}\n            size=\"sm\"\n            variant=\"destructive\"\n          >\n            {t(\"admin.clearSchedules\")}\n          </Button>\n          <Button\n            disabled={Boolean(clearing)}\n            onClick={() => setClearKind(\"errors\")}\n            size=\"sm\"\n            variant=\"destructive\"\n          >\n            {t(\"admin.clearErrors\")}\n          </Button>\n        </div>\n      ) : null}\n\n      <AlertDialog onOpenChange={(open) => !open && setClearKind(null)} open={clearKind !== null}>\n        <AlertDialogContent>\n          <AlertDialogHeader>\n            <AlertDialogTitle>{clearTitle}</AlertDialogTitle>\n            <AlertDialogDescription>{clearDescription}</AlertDialogDescription>\n          </AlertDialogHeader>\n          <AlertDialogFooter>\n            <AlertDialogCancel>{t(\"ui.common.cancel\")}</AlertDialogCancel>\n            <AlertDialogAction\n              variant=\"destructive\"\n              onClick={() => {\n                const kind = clearKind;\n                setClearKind(null);\n                if (kind === \"errors\") onClearErrors();\n                if (kind === \"schedules\") onClearSchedules();\n              }}\n            >\n              {clearLabel}\n            </AlertDialogAction>\n          </AlertDialogFooter>\n        </AlertDialogContent>\n      </AlertDialog>\n\n      <FailureDetailSheet\n""",
    )

    # 6. Copy and audit labels.
    for locale, entries in {
        "zh-TW": {
            "retry_anchor": "  'admin.retryAllQueued': '已將 {count} 項工作重新排入佇列。',",
            "retry_new": """  'admin.retryAllQueued': '已將 {count} 項工作重新排入佇列。',\n  'admin.clearSchedules': '清除所有排程',\n  'admin.clearSchedulesTitle': '清除所有背景工作排程？',\n  'admin.clearSchedulesDescription': '會停止目前等待中、執行中與失敗的背景工作，並清除外部資料刪除待辦。已完成的工作歷史與之後新建立的工作不受影響。',\n  'admin.clearSchedulesDone': '已清除 {count} 筆背景工作與待辦。',\n  'admin.clearErrors': '清除所有 Worker 錯誤',\n  'admin.clearErrorsTitle': '清除所有 Worker 錯誤紀錄？',\n  'admin.clearErrorsDescription': '會刪除這個頁面記錄的 Worker 錯誤統計。新的錯誤發生後仍會重新出現。',\n  'admin.clearErrorsDone': '已清除 {count} 筆 Worker 錯誤紀錄。',""",
            "ui_error_old": "  'ui.operations.errors': '錯誤與失敗投遞',",
            "ui_error_new": "  'ui.operations.errors': 'Worker 錯誤紀錄',",
            "audit_anchor": "  'ui.adminConsole.actionRebuildNotion': '重建 Notion 封存',",
            "audit_new": """  'ui.adminConsole.actionRebuildNotion': '重建 Notion 封存',\n  'ui.adminConsole.actionClearOperationalErrors': '清除系統錯誤紀錄',\n  'ui.adminConsole.actionClearScheduledWork': '清除背景工作排程',""",
            "already": "  'ui.operations.notionRebuildAlreadyQueued': 'Notion 完整重建已在等待或執行中',\n",
        },
        "en": {
            "retry_anchor": "  'admin.retryAllQueued': '{count} pieces of work queued for another attempt.',",
            "retry_new": """  'admin.retryAllQueued': '{count} pieces of work queued for another attempt.',\n  'admin.clearSchedules': 'Clear all schedules',\n  'admin.clearSchedulesTitle': 'Clear all background-work schedules?',\n  'admin.clearSchedulesDescription': 'This stops queued, running, and failed background jobs and clears the external-cleanup backlog. Completed history and work created later are unaffected.',\n  'admin.clearSchedulesDone': 'Cleared {count} background jobs and cleanup items.',\n  'admin.clearErrors': 'Clear all Worker errors',\n  'admin.clearErrorsTitle': 'Clear all Worker error records?',\n  'admin.clearErrorsDescription': 'This deletes the Worker error aggregates shown on this screen. New errors will appear again if they occur.',\n  'admin.clearErrorsDone': 'Cleared {count} Worker error records.',""",
            "ui_error_old": "  'ui.operations.errors': 'Errors and failed deliveries',",
            "ui_error_new": "  'ui.operations.errors': 'Worker error records',",
            "audit_anchor": "  'ui.adminConsole.actionRebuildNotion': 'Rebuild Notion archive',",
            "audit_new": """  'ui.adminConsole.actionRebuildNotion': 'Rebuild Notion archive',\n  'ui.adminConsole.actionClearOperationalErrors': 'Clear system error records',\n  'ui.adminConsole.actionClearScheduledWork': 'Clear background-work schedules',""",
            "already": "  'ui.operations.notionRebuildAlreadyQueued': 'A complete Notion rebuild is already queued or running',\n",
        },
    }.items():
        admin = root / f"src/i18n/messages/{locale}/admin.ts"
        replace_once(admin, entries["retry_anchor"], entries["retry_new"])
        ui = root / f"src/i18n/messages/{locale}/ui.ts"
        replace_once(ui, entries["ui_error_old"], entries["ui_error_new"])
        replace_once(ui, entries["audit_anchor"], entries["audit_new"])
        remove_once(ui, entries["already"])

    p = root / "src/components/admin/admin-audit-log.tsx"
    replace_once(
        p,
        'const ACTION_LABELS: Record<string, string> = {\n  rebuildNotionArchive: "ui.adminConsole.actionRebuildNotion",',
        'const ACTION_LABELS: Record<string, string> = {\n  clearOperationalErrors: "ui.adminConsole.actionClearOperationalErrors",\n  clearScheduledWork: "ui.adminConsole.actionClearScheduledWork",\n  rebuildNotionArchive: "ui.adminConsole.actionRebuildNotion",',
    )

    # 7. Integration coverage. Keep it in the existing operations suite so the repository map does not change.
    test_path = root / "tests/integration/operations-console.test.ts"
    replace_once(
        test_path,
        """  assert.equal(first.success, true);\n  assert.equal(first.alreadyQueued, false);\n  const cleared = asRecord(first.cleared);""",
        """  assert.equal(first.success, true);\n  const cleared = asRecord(first.cleared);""",
    )
    replace_once(
        test_path,
        """  assert.equal((await database.query<{ count: number }>(\n    'select count(*)::integer as count from app_private.background_jobs where id=$1', [staleRebuild],\n  )).rows[0].count, 0);""",
        """  assert.equal((await database.query<{ status: string }>(\n    'select status from app_private.background_jobs where id=$1', [staleRebuild],\n  )).rows[0].status, 'superseded');""",
    )
    replace_once(
        test_path,
        """  assert.equal(second.alreadyQueued, true);\n  assert.equal(second.jobId, first.jobId);\n  assert.equal(second.cleared, null);\n  const jobs = await database.query<{ count: number }>(\n    `select count(*)::integer as count from app_private.background_jobs\n     where job_type='notion_reconcile'`,\n  );\n  assert.equal(jobs.rows[0].count, 1);""",
        """  assert.notEqual(second.jobId, first.jobId);\n  assert.equal((await database.query<{ status: string }>(\n    'select status from app_private.background_jobs where id=$1', [first.jobId],\n  )).rows[0].status, 'superseded');\n  const jobs = await database.query<{ count: number }>(\n    `select count(*)::integer as count from app_private.background_jobs\n     where job_type='notion_reconcile' and status in ('pending','processing')`,\n  );\n  assert.equal(jobs.rows[0].count, 1);""",
    )
    append_once(
        test_path,
        "integrationTest('a Notion rebuild replaces every legacy active rebuild before starting fresh'",
        r'''
integrationTest('a Notion rebuild replaces every legacy active rebuild before starting fresh', async () => {
  const admin = await seedActor('notion-replace-admin', { roles: ['platform-admin'] });
  const member = await seedActor('notion-replace-member');
  const enabledEnvironment = { ...testEnvironment, NOTION_ENABLED: 'true' } as Env;

  await assert.rejects(
    () => withRuntimeEnvironment(enabledEnvironment, () => callAction('rebuildNotionArchive', {}, member.auth)),
    /permission-denied/,
  );

  await callAction('createIssue', {
    category: 'public-issues',
    content: 'legacy notion delivery',
    title: 'legacy notion delivery',
  }, member.auth);
  await database.query(`update app_private.event_deliveries
    set status='failed', last_attempt_id=gen_random_uuid(), error_detail='{"message":"legacy notion failure"}'::jsonb
    where destination='notion' and status='pending'`);

  const failedRebuild = crypto.randomUUID();
  const pendingRebuild = crypto.randomUUID();
  const processingRebuild = crypto.randomUUID();
  const notionDeletion = crypto.randomUUID();
  const cloudDeletion = crypto.randomUUID();
  const notionBacklog = crypto.randomUUID();
  const cloudBacklog = crypto.randomUUID();
  await database.query(`insert into app_private.background_jobs
    (id,job_type,status,attempt_count,last_attempt_id,locked_at,error_detail,payload)
    values
      ($1,'notion_reconcile','failed',3,gen_random_uuid(),null,'{"message":"legacy"}'::jsonb,'{}'::jsonb),
      ($2,'notion_reconcile','pending',0,null,null,null,'{}'::jsonb),
      ($3,'notion_reconcile','processing',1,gen_random_uuid(),now(),null,'{}'::jsonb),
      ($4,'deletion','failed',3,gen_random_uuid(),null,'{"message":"notion delete failed"}'::jsonb,'{"notion_page_id":"old-page","target_type":"issue","target_id":"old"}'::jsonb),
      ($5,'deletion','failed',3,gen_random_uuid(),null,'{"message":"cloud delete failed"}'::jsonb,'{"cloudinary_public_id":"keep-me","target_type":"upload","target_id":"old"}'::jsonb)`,
    [failedRebuild, pendingRebuild, processingRebuild, notionDeletion, cloudDeletion]);
  await database.query(`insert into app_private.external_cleanup_backlog(job_id,payload) values
    ($1,'{"notion_page_id":"old-page","target_type":"issue","target_id":"old"}'::jsonb),
    ($2,'{"cloudinary_public_id":"keep-me","target_type":"upload","target_id":"old"}'::jsonb)`,
    [notionBacklog, cloudBacklog]);
  await database.query(`insert into app_private.notion_pages(target_type,target_id,notion_page_id)
    values('issue',$1,'legacy-page')`, [crypto.randomUUID()]);

  const first = asRecord(await withRuntimeEnvironment(
    enabledEnvironment,
    () => callAction('rebuildNotionArchive', {}, admin.auth),
  ));
  const cleared = asRecord(first.cleared);
  assert.equal(cleared.jobs, 4);
  assert.equal(cleared.cleanup, 1);
  assert.ok(Number(cleared.deliveries) > 0);
  assert.equal(cleared.mappings, 1);

  const oldJobs = await database.query<{ id: string; status: string }>(
    'select id,status from app_private.background_jobs where id = any($1::uuid[]) order by id',
    [[failedRebuild, pendingRebuild, processingRebuild, notionDeletion]],
  );
  assert.equal(oldJobs.rows.length, 4);
  assert.ok(oldJobs.rows.every((job) => job.status === 'superseded'));
  assert.equal((await database.query<{ status: string }>(
    'select status from app_private.background_jobs where id=$1', [cloudDeletion],
  )).rows[0].status, 'failed');
  assert.deepEqual((await database.query<{ job_id: string }>(
    'select job_id from app_private.external_cleanup_backlog order by job_id',
  )).rows.map((row) => row.job_id), [cloudBacklog]);

  const firstJobId = String(first.jobId);
  const activeAfterFirst = await database.query<{ id: string }>(`
    select id from app_private.background_jobs
    where job_type='notion_reconcile' and status in ('pending','processing')`);
  assert.deepEqual(activeAfterFirst.rows.map((row) => row.id), [firstJobId]);

  const second = asRecord(await withRuntimeEnvironment(
    enabledEnvironment,
    () => callAction('rebuildNotionArchive', {}, admin.auth),
  ));
  const secondJobId = String(second.jobId);
  assert.notEqual(secondJobId, firstJobId);
  assert.equal((await database.query<{ status: string }>(
    'select status from app_private.background_jobs where id=$1', [firstJobId],
  )).rows[0].status, 'superseded');
  const activeAfterSecond = await database.query<{ id: string }>(`
    select id from app_private.background_jobs
    where job_type='notion_reconcile' and status in ('pending','processing')`);
  assert.deepEqual(activeAfterSecond.rows.map((row) => row.id), [secondJobId]);
});

integrationTest('administrators can clear Worker error records and scheduled background work', async () => {
  const admin = await seedActor('operations-clear-admin', { roles: ['platform-admin'] });
  const member = await seedActor('operations-clear-member');
  await database.query(`insert into app_private.operational_errors(action,code,status,operation_id) values
    ('legacy-one','internal',500,$1),('legacy-two','internal',500,$2)`,
    [crypto.randomUUID(), crypto.randomUUID()]);

  await assert.rejects(() => callAction('clearOperationalErrors', {}, member.auth), /permission-denied/);
  const errors = asRecord(await callAction('clearOperationalErrors', {}, admin.auth));
  assert.ok(Number(errors.cleared) >= 2);
  assert.equal((await database.query<{ count: number }>(
    'select count(*)::integer as count from app_private.operational_errors',
  )).rows[0].count, 0);

  const pending = crypto.randomUUID();
  const failed = crypto.randomUUID();
  const completed = crypto.randomUUID();
  const backlog = crypto.randomUUID();
  await database.query(`insert into app_private.background_jobs
    (id,job_type,status,attempt_count,last_attempt_id,error_detail,completed_at,payload)
    values
      ($1,'notion_reconcile','pending',0,null,null,null,'{}'::jsonb),
      ($2,'deletion','failed',3,gen_random_uuid(),'{"message":"failed"}'::jsonb,null,'{}'::jsonb),
      ($3,'deletion','completed',1,gen_random_uuid(),null,now(),'{}'::jsonb)`,
    [pending, failed, completed]);
  await database.query(`insert into app_private.external_cleanup_backlog(job_id,payload)
    values($1,'{"cloudinary_public_id":"old"}'::jsonb)`, [backlog]);

  await assert.rejects(() => callAction('clearScheduledWork', {}, member.auth), /permission-denied/);
  const schedules = asRecord(await callAction('clearScheduledWork', {}, admin.auth));
  assert.equal(schedules.jobs, 2);
  assert.equal(schedules.cleanup, 1);
  assert.equal(schedules.cleared, 3);
  const statuses = await database.query<{ id: string; status: string }>(
    'select id,status from app_private.background_jobs where id = any($1::uuid[]) order by id',
    [[pending, failed, completed]],
  );
  const byId = new Map(statuses.rows.map((row) => [row.id, row.status]));
  assert.equal(byId.get(pending), 'superseded');
  assert.equal(byId.get(failed), 'superseded');
  assert.equal(byId.get(completed), 'completed');
  assert.equal((await database.query<{ count: number }>(
    'select count(*)::integer as count from app_private.external_cleanup_backlog',
  )).rows[0].count, 0);
});
''',
    )

    # 8. Generated action contracts are derived from config, never hand-edited.
    run("bun", "run", "generate:all")
    if args.verify:
        run("bun", "run", "verify:fast")
        run("bun", "run", "verify:integration")

    print("Applied Novae recovery fix (v3).")
    print("Run: git diff --check && git diff")
    if not args.verify:
        print("Then run: bun run verify:fast && bun run verify:integration")


if __name__ == "__main__":
    main()
