import assert from 'node:assert/strict';
import test from 'node:test';
import { read } from './helpers.mjs';

test('content feeds share 30-item batches and bounded load-more controls', async () => {
  const pageSize = await read('src/lib/page-size.ts');
  const infiniteScroll = await read('src/composables/useInfiniteScroll.ts');
  const loadMoreControl = await read('src/components/ui/molecules/FeedLoadMoreControl.vue');
  const issueSearch = await read('src/composables/useIssueSearch.ts');
  const feedMigration = await read('supabase/migrations/202607140001_unified_feed_pagination.sql');
  const issueRead = await read('supabase/functions/backendAction/issue-read.ts');

  assert.match(pageSize, /CONTENT_FEED_PAGE_SIZE = 30/u);
  assert.match(pageSize, /COMMENT_FEED_PAGE_SIZE = 30/u);
  assert.match(pageSize, /NOTIFICATION_FEED_PAGE_SIZE = 30/u);
  assert.match(infiniteScroll, /options\.root\?\.value/u);
  assert.match(infiniteScroll, /loadPending/u);
  assert.match(loadMoreControl, /rounded-full/u);
  assert.match(loadMoreControl, /common\.loadMore/u);
  assert.match(loadMoreControl, /LoadingSpinner/u);
  assert.match(issueSearch, /loadMoreSearchResults/u);
  assert.match(feedMigration, /reply_groups as materialized/u);
  assert.match(feedMigration, /create or replace function app_api\.backend_list_issues/u);
  assert.match(feedMigration, /create or replace function app_api\.backend_list_notifications/u);
  assert.match(feedMigration, /backend_issue_list_to_json/u);
  assert.match(feedMigration, /array_agg\(issue_id\)/u);
  assert.match(issueRead, /delete issue\.content/u);
});

test('content writes validate markdown uploads before database writes', async () => {
  const uploads = await read('supabase/functions/backendAction/uploads.ts');
  const issueCreate = await read('supabase/functions/backendAction/issue-create.ts');
  const issueComments = await read('supabase/functions/backendAction/issue-comments.ts');
  const announcementWrite = await read('supabase/functions/backendAction/announcement-write.ts');
  const announcementComments = await read('supabase/functions/backendAction/announcement-comments.ts');
  const hardeningMigration = await read('supabase/migrations/202607100004_security_usage_hardening.sql');

  assert.match(uploads, /function extractMarkdownUploadIds/u);
  assert.match(uploads, /export async function validateMarkdownUploadsBeforeCreate/u);
  assert.match(uploads, /export async function validateMarkdownUploadsBeforeUpdate/u);
  assert.match(uploads, /upload\.attached_target_type === targetType && upload\.attached_target_id === targetId/u);
  assert.match(uploads, /upload\.owner_uid === ownerUid && !upload\.attached_target_id/u);
  assert.match(hardeningMigration, /create trigger attach_issue_markdown_uploads/u);
  assert.match(hardeningMigration, /target_type_name = 'announcement' or owner_uid = new\.author_uid/u);
  assert.match(hardeningMigration, /revoke all on function app_private\.emit_content_realtime_event[\s\S]*from public, anon, authenticated/u);
  assert.ok(
    issueCreate.indexOf('validateMarkdownUploadsBeforeCreate') < issueCreate.indexOf('rpc("backend_create_issue"'),
    'issue creation must validate upload attachments before creating the issue',
  );
  assert.ok(
    issueComments.indexOf('validateMarkdownUploadsBeforeCreate') < issueComments.indexOf('rpc("backend_create_issue_comment"'),
    'issue comment creation must validate upload attachments before creating the comment',
  );
  assert.ok(
    announcementWrite.indexOf('validateMarkdownUploadsBeforeCreate') < announcementWrite.indexOf('rpc("backend_create_announcement"'),
    'announcement creation must validate upload attachments before creating the announcement',
  );
  assert.ok(
    announcementComments.indexOf('validateMarkdownUploadsBeforeCreate') < announcementComments.indexOf('rpc("backend_create_announcement_comment"'),
    'announcement comment creation must validate upload attachments before creating the comment',
  );
});

test('comment realtime triggers pass an explicit operation to the emitter', async () => {
  const migration = await read('supabase/migrations/202607120001_fix_comment_realtime_overload.sql');

  assert.match(migration, /queue_issue_comment_realtime_event[\s\S]*lower\(tg_op\)/u);
  assert.match(migration, /queue_announcement_comment_realtime_event[\s\S]*lower\(tg_op\)/u);
  assert.match(
    migration,
    /drop function if exists app_private\.emit_content_realtime_event\([\s\S]*integer\s*\);/u,
  );
  assert.match(
    migration,
    /drop function if exists app_private\.emit_content_realtime_event\([\s\S]*integer,\s*text\s*\);/u,
  );
  assert.match(migration, /create function app_private\.emit_content_realtime_event/u);
  assert.match(migration, /comment_count integer,\s*op text\s*\)/u);
  assert.doesNotMatch(migration, /op text default/u);
});

test('issue cascade deletion keeps dependent triggers parent-safe', async () => {
  const migration = await read('supabase/migrations/202607120002_harden_cascade_delete_triggers.sql');

  assert.match(migration, /mark_notion_support_dirty[\s\S]*tg_op = 'DELETE'[\s\S]*not exists/u);
  assert.match(migration, /track_issue_category_counter[\s\S]*-related_comments/u);
  assert.match(migration, /if tg_op = 'DELETE' then\s*return old;[\s\S]*return new;/u);
  assert.match(migration, /track_comment_category_counter[\s\S]*old_category is not null/u);
  assert.match(
    migration,
    /create trigger track_issue_category_counter\s*before insert or delete or update of category/u,
  );
});

test('configured retention covers closed content and operational records', async () => {
  const config = await read('config/data-retention.config.json');
  const generator = await read('scripts/generate-data-retention.mjs');
  const maintenanceCleanup = await read('supabase/functions/maintenanceCleanup/index.ts');
  const migration = await read('supabase/migrations/202607160001_configurable_retention_cleanup.sql');
  const hardeningMigration = await read('supabase/migrations/202607160003_harden_retention_deletion_flow.sql');
  const outboxWorker = await read('supabase/functions/outboxWorker/index.ts');
  const minimizedOutbox = await read('supabase/migrations/202607230001_minimize_outbox_payloads.sql');

  assert.match(config, /"closedIssuesDays": 180/u);
  assert.match(config, /"closedFacilitiesDays": 180/u);
  assert.match(config, /"notificationsDays"/u);
  assert.match(config, /"realtimeEventsHours": 3/u);
  assert.match(config, /"inactivePushTokensDays": 60/u);
  assert.match(config, /"pushDeliverySentDays"/u);
  assert.match(generator, /data-retention\.config\.json/u);
  assert.match(maintenanceCleanup, /retention_config: DATA_RETENTION/u);
  assert.match(migration, /expired_closed_issues_deleted/u);
  assert.match(migration, /expired_closed_facilities_deleted/u);
  assert.match(migration, /role_assignment_audit_deleted/u);
  assert.match(hardeningMigration, /drop function if exists app_api\.run_maintenance_cleanup\(text\[\]\)/u);
  assert.match(hardeningMigration, /drop function if exists app_private\.run_maintenance_cleanup\(text\[\]\)/u);
  assert.match(hardeningMigration, /with expired_issues as materialized/u);
  assert.match(hardeningMigration, /with expired_facilities as materialized/u);
  assert.match(hardeningMigration, /'retention_cleanup', true/u);
  assert.match(hardeningMigration, /notion_page\.target_type = 'issue'/u);
  assert.match(hardeningMigration, /notion_page\.target_type = 'facility'/u);
  assert.match(hardeningMigration, /expired_closed_issue_notion_deletions_queued/u);
  assert.match(hardeningMigration, /expired_closed_facility_notion_deletions_queued/u);
  assert.match(outboxWorker, /event\.payload\.retention_cleanup === true\) return null/u);
  assert.match(outboxWorker, /event\.payload\.retention_cleanup === true[\s\S]*forgetMappedNotionPage/u);
  assert.match(outboxWorker, /hydrateCommentContent/u);
  assert.doesNotMatch(minimizedOutbox, /'content',new\.content|'content',row_record\.content/u);
  assert.match(minimizedOutbox, /payload = payload - 'content'/u);
});

test('authenticated list caching is identity scoped and browser private', async () => {
  const worker = await read('cloudflare/src/index.ts');
  assert.match(worker, /AUTH_SCOPED_LIST_CACHE_TTL_SECONDS = 30/u);
  assert.match(worker, /CACHEABLE_LIST_ACTIONS/u);
  assert.match(worker, /requireFirebaseUid\(request, env\)[\s\S]*forwardCachedListAction/u);
  assert.match(worker, /`\$\{uid\}\\u0000\$\{origin\}\\u0000\$\{bodyText\}`/u);
  assert.match(worker, /headers\.set\('cache-control', 'no-store'\)/u);
  assert.match(worker, /workerCache\.put/u);
});

test('facilities and author-fixed support use independent atomic storage', async () => {
  const migration = await read('supabase/migrations/202607150003_facilities_rbac.sql');
  const facilityService = await read('src/services/facilities.ts');
  const facilityAction = await read('supabase/functions/backendAction/facilities.ts');
  const facilityTypes = await read('src/types/index.ts');
  const notion = await read('supabase/functions/_shared/notion.ts');
  const maintenanceCleanup = await read('supabase/functions/maintenanceCleanup/index.ts');
  const legacyAdminBackfill = await read('supabase/migrations/202607150004_backfill_legacy_platform_admins.sql');
  const syncUser = await read('supabase/functions/syncUser/index.ts');
  const supabaseAuth = await read('src/services/supabase-auth.ts');

  assert.match(migration, /create table if not exists app_private\.facility_reports/u);
  assert.match(migration, /create table if not exists app_private\.facility_report_affected_users/u);
  assert.match(migration, /primary key \(facility_id,\s*uid\)/u);
  assert.match(migration, /affected_count integer not null default 1/u);
  assert.match(migration, /if facility\.author_uid=actor_uid then raise exception 'facility-author-fixed'/u);
  assert.match(migration, /affected_count=affected_count\+case when now_affected then 1 else -1 end/u);
  assert.match(migration, /if issue_record\.author_uid = actor_uid then raise exception 'support-not-available'/u);
  assert.match(migration, /case when support_enabled then 1 else 0 end/u);
  assert.match(migration, /drop table if exists app_private\.notion_support_dirty/u);
  assert.match(migration, /cron\.unschedule\(jobid\)[\s\S]*srp_notion_support_sync/u);
  assert.doesNotMatch(maintenanceCleanup, /notion_support|syncIssueSupport/u);
  assert.match(facilityService, /invokeBackendAction[\s\S]*listFacilities/u);
  assert.match(facilityAction, /cursor_id: asUuid\(cursor\.id\) \|\| null/u);
  assert.match(facilityTypes, /export type FacilityStatus = 'pending' \| 'processing' \| 'completed' \| 'unable-to-handle'/u);
  assert.match(notion, /if \(!terminal\) return/u);
  assert.match(notion, /"遇到人數"[\s\S]*facility\.affected_count/u);
  assert.match(notion, /"附議數": richTextProperty\(/u);
  assert.match(notion, /await buildIssueManagedContent\(supabase, targetId/u);
  assert.match(legacyAdminBackfill, /from app_private\.user_roles[\s\S]*where role = 'admin'/u);
  assert.match(legacyAdminBackfill, /'platform-admin'/u);
  assert.match(syncUser, /backend_reconcile_platform_admins[\s\S]*admin_emails: adminEmails\(\)/u);
  assert.doesNotMatch(syncUser, /legacyRole|user_role_assignments/u);
  assert.doesNotMatch(supabaseAuth, /if \(token\.claims\.role === 'authenticated'\) \{\s*return;/u);
});

test('proposal and facility manager access is runtime-configured and category-scoped', async () => {
  const accessView = await read('src/components/admin/MemberAccessPanel.vue');
  const administrationView = await read('src/views/AdministrationView.vue');
  const categoryWorkflow = await read('src/components/admin/CategoryWorkflowPanel.vue');
  const categoryAction = await read('supabase/functions/backendAction/categories.ts');
  const auth = await read('supabase/functions/backendAction/auth.ts');
  const users = await read('supabase/functions/backendAction/users.ts');
  const userAccess = await read('supabase/functions/backendAction/user-access.ts');
  const accessManagement = await read('src/composables/useMemberAccessManagement.ts');
  const memberAccessRow = await read('src/components/admin/MemberAccessRow.vue');
  const memberAccessListSkeleton = await read('src/components/admin/MemberAccessListSkeleton.vue');
  const issueRead = await read('supabase/functions/backendAction/issue-read.ts');
  const migration = await read('supabase/migrations/202607150006_category_scoped_proposal_access.sql');
  const lookupMigration = await read('supabase/migrations/202607150007_access_lookup_and_facility_status.sql');
  const atomicAccessMigration = await read('supabase/migrations/202607200002_atomic_user_access.sql');
  const scopedAccessMigration = await read('supabase/migrations/202607220001_scoped_user_access.sql');
  const facilityParityMigration = await read('supabase/migrations/202607200004_facility_category_parity_and_personal_notifications.sql');
  const selectionControl = await read('src/components/ui/molecules/SelectionOptionButton.vue');
  const facilityDialog = await read('src/components/FacilityStatusDialog.vue');
  const statusTransitionDialog = await read('src/components/ui/organisms/StatusTransitionDialog.vue');

  assert.match(accessView, /activeIssueCategories/u);
  assert.match(accessView, /activeFacilityCategories/u);
  assert.match(categoryAction, /getIssueCategories/u);
  assert.match(categoryAction, /action === "saveCategoryManagement"/u);
  assert.match(migration, /primary key \(uid, category_id\)/u);
  assert.match(users, /handleUserAccessAction/u);
  assert.match(userAccess, /backend_update_user_access_scope[\s\S]*scope_kind: scope\.kind[\s\S]*grant_access: payload\.grant/u);
  assert.match(atomicAccessMigration, /create or replace function app_api\.backend_set_user_access/u);
  assert.match(atomicAccessMigration, /role_code not in \('announcement-manager', 'general-affairs'\)/u);
  assert.match(atomicAccessMigration, /backend_reconcile_platform_admins/u);
  assert.match(atomicAccessMigration, /if 'platform-admin' = any\(previous_roles\)[\s\S]*permission-denied/u);
  assert.match(atomicAccessMigration, /issue_categories where id = any\(issue_ids\) and is_active/u);
  assert.match(atomicAccessMigration, /facility_categories where id = any\(facility_ids\) and is_active/u);
  assert.match(atomicAccessMigration, /access_assignment_audit/u);
  assert.match(scopedAccessMigration, /create or replace function app_api\.backend_update_user_access_scope/u);
  assert.match(scopedAccessMigration, /for update/u);
  assert.match(scopedAccessMigration, /on conflict on constraint user_facility_category_assignments_pkey do nothing/u);
  assert.match(scopedAccessMigration, /drop function app_api\.backend_set_user_access/u);
  assert.match(auth, /canManageIssueCategory/u);
  assert.match(auth, /return auth\.isAdmin \|\| auth\.managedFacilityCategoryIds\.includes\(categoryId\)/u);
  assert.match(facilityParityMigration, /facility\.category_id = category_filter/u);
  assert.match(facilityParityMigration, /'category_id', category_id/u);
  assert.match(facilityParityMigration, /managed_category_ids/u);
  assert.match(issueRead, /canManageIssueCategory\(auth, category\)/u);
  assert.match(userAccess, /if \(!rawQuery && !scope\) throw new Error\("validation-required"\)/u);
  assert.match(userAccess, /const rawQuery = asString\(payload\.query\)\.trim\(\)/u);
  assert.doesNotMatch(userAccess, /includeDirectory|accessDirectoryUids/u);
  assert.match(userAccess, /rawQuery\.includes\("@"\) \? rawQuery\.toLowerCase\(\) : rawQuery/u);
  assert.match(userAccess, /profileQuery = query\.includes\("@"\) \? profileQuery\.eq\("email", query\) : profileQuery\.eq\("uid", query\)/u);
  assert.match(userAccess, /scope\.kind === "announcement"[\s\S]*\.eq\("role_code", "announcement-manager"\)/u);
  assert.doesNotMatch(userAccess, /const roleCodes = \["platform-admin"/u);
  assert.match(lookupMigration, /user_profiles_email_unique_idx/u);
  assert.match(lookupMigration, /backend_update_facility_status\.result_content/u);
  assert.match(accessView, /SelectionOptionButton/u);
  assert.doesNotMatch(administrationView, /SelectionOptionButton/u);
  assert.match(administrationView, /role="tablist"[\s\S]*<AppButton[\s\S]*role="tab"/u);
  assert.match(categoryWorkflow, /<PillSegmentedControl[\s\S]*layout="equal"/u);
  assert.doesNotMatch(accessView, /PillSegmentedControl/u);
  assert.doesNotMatch(accessView, /accessInheritedFromPlatformAdmin|fullAccessSummary|hasInheritedAccess/u);
  assert.doesNotMatch(accessView, /value: 'platform'|platformAdminTitle/u);
  assert.ok(accessView.indexOf('chooseResponsibilityStep') < accessView.indexOf('access-member-lookup'));
  assert.match(accessView, /useMemberAccessManagement/u);
  assert.match(accessManagement, /listScopeMembers[\s\S]*lookupAccessMember[\s\S]*setUserAccessScope/u);
  assert.match(accessView, /WorkflowStepHeader/u);
  assert.equal((accessView.match(/<MemberAccessRow/gu) ?? []).length, 2);
  assert.match(memberAccessRow, /ListSurfaceRow[\s\S]*UserAvatar[\s\S]*BusyButtonContent/u);
  assert.equal((accessView.match(/<MemberAccessListSkeleton/gu) ?? []).length, 2);
  assert.match(memberAccessListSkeleton, /SurfacePanel[\s\S]*ListSurfaceRow[\s\S]*skeleton-enter[\s\S]*SkeletonBlock/u);
  assert.match(accessView, /aria-live="polite"[\s\S]*memberDirectoryStatus/u);
  assert.match(accessView, /prefers-reduced-motion/u);
  assert.match(accessView, /scrollIntoView/u);
  assert.match(accessView, /categories\.length === 1[\s\S]*selectedCategoryId\.value/u);
  assert.match(facilityDialog, /StatusTransitionDialog/u);
  assert.match(statusTransitionDialog, /SelectionOptionButton/u);
  assert.match(selectionControl, /button-toolbar--active[\s\S]*SelectionMark/u);
});

test('facility next actions and account UID use existing detail controls', async () => {
  const facilityDetail = await read('src/views/FacilityDetailView.vue');
  const facilityPanel = await read('src/components/FacilityDetailPagePanel.vue');
  const facilityActions = await read('src/components/FacilityDetailActions.vue');
  const detailPagePanel = await read('src/components/ContentDetailPagePanel.vue');
  const contentDetailBody = await read('src/components/ContentDetailBody.vue');
  const contentNoticePanel = await read('src/components/ui/molecules/ContentNoticePanel.vue');
  const facilityTableRow = await read('src/components/FacilityTableRow.vue');
  const settingsView = await read('src/views/SettingsView.vue');
  const settingsPanel = await read('src/components/SettingsPanelContent.vue');
  const shareUrl = await read('src/composables/useShareUrl.ts');
  const proposalFooter = await read('src/components/IssueDetailSupportFooter.vue');
  const voteButtons = await read('src/components/VoteButtons.vue');
  const detailActionGroup = await read('src/components/ui/molecules/DetailActionGroup.vue');
  const operationTimes = await read('src/components/ui/molecules/OperationTimeList.vue');
  const detailRouteState = await read('src/components/ui/organisms/DetailRouteState.vue');

  assert.match(facilityDetail, /FacilityDetailPagePanel/u);
  assert.match(facilityDetail, /DetailRouteState/u);
  assert.match(detailRouteState, /SkeletonDetail/u);
  assert.match(facilityDetail, /ConfirmDialog/u);
  assert.match(facilityDetail, /useShareUrl/u);
  assert.match(facilityPanel, /#actions="\{ compact \}"/u);
  assert.match(facilityPanel, /:compact="compact"/u);
  assert.match(facilityActions, /DetailActionButton/u);
  assert.match(voteButtons, /v-if="compact"[\s\S]*:variant="supportVariant"[\s\S]*<DetailActionButton[\s\S]*v-else[\s\S]*:active="optimisticSupported"/u);
  assert.match(facilityActions, /DetailActionGroup/u);
  assert.match(detailActionGroup, /label="common\.share"/u);
  assert.match(facilityPanel, /ContentDetailPagePanel/u);
  assert.match(facilityPanel, /:context-content="facility\.location"[\s\S]*context-title="facility\.place"/u);
  assert.match(facilityPanel, /<TagBadge[\s\S]*categoryLabel/u);
  assert.match(facilityPanel, /findFacilityCategory\(props\.facility\.category_id\)/u);
  assert.doesNotMatch(facilityPanel, /authorSecondary/u);
  assert.match(facilityTableRow, /ContentNoticePanel compact[\s\S]*facility\.location[\s\S]*#trailing[\s\S]*affectedCount/u);
  assert.doesNotMatch(facilityTableRow, /categoryLabel|findFacilityCategory/u);
  assert.match(detailPagePanel, /ContentDetailBody/u);
  assert.match(contentDetailBody, /contextContent[\s\S]*ContentNoticePanel[\s\S]*noticeContent/u);
  assert.match(contentNoticePanel, /compact \? 'inset' : 'control'[\s\S]*bg-error-container[\s\S]*bg-success-container/u);
  assert.equal((contentDetailBody.match(/<MarkdownMediaContent/gu) ?? []).length, 2);
  assert.match(facilityDetail, /facility\.startProcessing' : 'facility\.completeCannotResolve/u);
  assert.match(facilityDetail, /facility\.waitingTime[\s\S]*facility\.startProcessingTime[\s\S]*facility\.markedUnresolved/u);
  assert.match(facilityActions, /:operation-time-items="operationTimeItems"/u);
  assert.match(proposalFooter, /:operation-time-items="operationTimeItems"/u);
  assert.match(detailActionGroup, /OperationTimeList/u);
  assert.match(operationTimes, /compact \? `\$\{t\(item\.shortLabel\)\}:` : `\$\{t\(item\.label\)\}:`/u);
  assert.doesNotMatch(facilityDetail, />更新狀態</u);
  assert.match(settingsView, /:uid="user\.uid"/u);
  assert.match(settingsPanel, /t\('account\.uidLabel'\)[\s\S]*\{\{ uid \}\}[\s\S]*name="copy"/u);
  assert.match(settingsPanel, /show\(t\('settings\.uidCopied'\), 'success'\)/u);
  assert.match(shareUrl, /export async function copyText/u);
});

test('announcement editing is removed across frontend, backend, and database', async () => {
  const actionContract = await read('src/services/backend-action-contract.ts');
  const announcementService = await read('src/services/announcements.ts');
  const announcementWrite = await read('supabase/functions/backendAction/announcement-write.ts');
  const actionRegistry = await read('supabase/functions/backendAction/action-registry.ts');
  const removalMigration = await read('supabase/migrations/202607120003_remove_announcement_editing.sql');

  assert.doesNotMatch(actionContract, /updateAnnouncement/u);
  assert.doesNotMatch(announcementService, /updateAnnouncement/u);
  assert.doesNotMatch(announcementWrite, /updateAnnouncement|backend_update_announcement/u);
  assert.doesNotMatch(actionRegistry, /updateAnnouncement/u);
  assert.match(removalMigration, /drop function if exists app_api\.backend_update_announcement/u);
});

test('announcement writes open the created detail and invalidate list-page caches', async () => {
  const composer = await read('src/components/AnnouncementComposer.vue');
  const composerView = await read('src/views/AnnouncementComposerView.vue');
  const announcements = await read('src/services/announcements.ts');

  assert.match(composer, /const announcement = await createAnnouncement\([\s\S]*emit\('submitted', announcement\)/u);
  assert.match(composerView, /name: 'announcement-detail'[\s\S]*announcementId: announcement\.id/u);
  assert.match(announcements, /const ANNOUNCEMENT_LIST_CACHE_PREFIX = 'announcement-list-page\|'/u);
  assert.match(
    announcements,
    /createAnnouncement[\s\S]*markContentCachePrefixStale\(ANNOUNCEMENT_LIST_CACHE_PREFIX\)/u,
  );
  assert.match(
    announcements,
    /deleteAnnouncement[\s\S]*markContentCachePrefixStale\(ANNOUNCEMENT_LIST_CACHE_PREFIX\)/u,
  );
});

test('realtime-backed lists revalidate after stale resumes without fixed polling', async () => {
  const discussionComments = await read('src/composables/useDiscussionComments.ts');
  const announcementManagement = await read('src/composables/useAnnouncementManagement.ts');
  const issueBoard = await read('src/composables/useIssueBoardData.ts');
  const realtimeEvents = await read('src/services/realtime-events.ts');
  const boardControls = await read('src/components/BoardControls.vue');
  const appShell = await read('src/components/AppShell.vue');
  const appShellNavigation = [
    await read('src/components/app-shell/AppDesktopSidebar.vue'),
    await read('src/components/app-shell/AppMobileBottomNav.vue'),
  ].join('\n');
  const activeNavigationRefresh = await read('src/composables/useActiveNavigationRefresh.ts');
  const announcements = await read('src/services/announcements.ts');
  const issueWrites = await read('src/services/issues-write.ts');

  assert.doesNotMatch(discussionComments, /setInterval/u);
  assert.match(discussionComments, /registerAppResumeHandler/u);
  assert.match(discussionComments, /shouldRefreshContentAfterResume/u);
  assert.match(discussionComments, /forceRefresh: options\.force === true \|\| hydrated/u);
  assert.match(announcementManagement, /refreshAnnouncementList\(\{ force: true \}\)/u);
  assert.doesNotMatch(announcementManagement, /setInterval/u);
  assert.doesNotMatch(issueBoard, /setInterval/u);
  assert.match(announcementManagement, /shouldRefreshContentAfterResume/u);
  assert.match(issueBoard, /shouldRefreshContentAfterResume/u);
  assert.match(issueBoard, /invalidateIssueBuckets\(\)/u);
  assert.match(realtimeEvents, /scheduleReconnect/u);
  assert.match(realtimeEvents, /status !== 'CHANNEL_ERROR'.*status !== 'TIMED_OUT'.*status !== 'CLOSED'/u);
  assert.doesNotMatch(boardControls, /aria-label="重新整理提案"/u);
  await assert.rejects(read('src/components/AnnouncementControls.vue'));
  assert.match(appShell, /@navigate="handleNavigationClick"/u);
  assert.match(appShellNavigation, /\$emit\('navigate', item\.isActive\)/u);
  assert.match(activeNavigationRefresh, /refreshFromActiveNavigation/u);
  assert.match(announcements, /`announcement-comments-page\|\$\{announcementId\}\|`/u);
  assert.match(issueWrites, /`issue-comments-page\|\$\{issueId\}\|`/u);
});
