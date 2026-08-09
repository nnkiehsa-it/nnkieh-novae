import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { read, listFiles } from './helpers.mjs';

test('personal notification writes and pushes are scoped to the recipient', async () => {
  const backendAction = [
    await read('supabase/functions/backendAction/issue-comments.ts'),
    await read('supabase/functions/backendAction/issue-delete.ts'),
    await read('supabase/functions/backendAction/issue-moderation.ts'),
    await read('supabase/functions/backendAction/announcement-comments.ts'),
  ].join('\n');
  const outboxWorker = await read('supabase/functions/outboxWorker/index.ts');
  const securityMigration = await read('supabase/migrations/202607050001_supabase_baseline.sql');
  const atomicOutboxMigration = await read('supabase/migrations/202607050006_atomic_content_outbox.sql');
  const announcementCommentNotificationMigration = await read('supabase/migrations/202607090005_announcement_comment_author_notifications.sql');
  const issueSupporterNotificationMigration = await read('supabase/migrations/202607160005_issue_supporter_notifications.sql');
  const notificationView = await read('src/views/NotificationsView.vue');
  const notificationDisplay = await read('src/composables/useNotificationDisplay.ts');
  const uidOnlyMigration = await read('supabase/migrations/202607210001_uid_only_author_profiles.sql');
  const pushRetryMigration = await read('supabase/migrations/202607290002_retryable_push_deliveries.sql');

  assert.match(atomicOutboxMigration, /'issue\.comment_created'/u);
  assert.match(atomicOutboxMigration, /'issue_author_uid', issue_record\.author_uid/u);
  assert.match(atomicOutboxMigration, /'issue\.status_changed'/u);
  assert.match(atomicOutboxMigration, /queue_announcement_comment_created/u);
  assert.match(announcementCommentNotificationMigration, /'announcement_author_uid', announcement_record\.author_uid/u);
  assert.match(backendAction, /rpc\("backend_delete_issue_with_upload_targets"/u);
  assert.match(securityMigration, /'issue\.deleted'/u);
  assert.match(securityMigration, /'author_uid', issue_record\.author_uid/u);
  assert.match(issueSupporterNotificationMigration, /jsonb_agg\(supporter\.uid order by supporter\.created_at\)/u);
  assert.match(issueSupporterNotificationMigration, /'supporter_uids', supporter_uids/u);
  assert.match(outboxWorker, /async function findIssueAuthorUid/u);
  assert.match(outboxWorker, /async function findAnnouncementCommentRecipientUid/u);
  assert.match(outboxWorker, /asString\(event\.payload\.issue_author_uid\)\s*\|\|\s*asString\(event\.payload\.author_uid\)/u);
  assert.match(outboxWorker, /asString\(event\.payload\.announcement_author_uid\)/u);
  assert.match(outboxWorker, /async function resolveNotification/u);
  assert.match(outboxWorker, /source: "user", type: "issue_created"/u);
  assert.match(outboxWorker, /source: "user", type: "facility_report_created"/u);
  assert.match(outboxWorker, /user_issue_category_assignments/u);
  assert.match(outboxWorker, /user_facility_category_assignments/u);
  assert.match(outboxWorker, /recipientUid === event\.actor_uid/u);
  assert.match(outboxWorker, /recipient_uid: recipientUid/u);
  assert.match(outboxWorker, /from\("supports"\)[\s\S]*select\("uid"\)\.eq\("issue_id", event\.target_id\)/u);
  assert.match(outboxWorker, /asStringArray\(event\.payload\.supporter_uids\)/u);
  assert.match(outboxWorker, /new Set\(\[authorUid, \.\.\.supporterUids\]/u);
  assert.match(outboxWorker, /event\.event_type === "support\.goal_met" \|\| uid !== event\.actor_uid/u);
  assert.match(outboxWorker, /query = query\.in\("uid", recipientUids\)/u);
  assert.match(outboxWorker, /upsert\(notifications, \{ ignoreDuplicates: true, onConflict: "id" \}\)/u);
  assert.match(outboxWorker, /deliverPushes\(supabase, event\.id, base, recipients, log\)/u);
  assert.match(outboxWorker, /retryPushDeliveries\(supabase, log\)/u);
  assert.match(pushRetryMigration, /claim_push_delivery_jobs[\s\S]*for update skip locked/u);
  assert.match(pushRetryMigration, /fail_push_delivery_job[\s\S]*power\(2/u);
  assert.doesNotMatch(outboxWorker, /srp-admin|topic_admin/u);
  assert.doesNotMatch(outboxWorker, /title: "新提案待審核"|title: "新提案待處理"/u);
  assert.match(outboxWorker, /title: "設備狀態已變更"/u);
  assert.match(outboxWorker, /title: isReviewApproved \? "提案審核已通過" : "提案狀態已變更"/u);
  assert.match(outboxWorker, /`\$\{title\} 已通過審核並開放附議。`/u);
  assert.match(outboxWorker, /`\$\{title\} 現在狀態為 \$\{issueStatusLabel\(newStatus\)\}`/u);
  assert.match(outboxWorker, /async function findDisplayName/u);
  assert.match(outboxWorker, /title: actorName \? `來自 \$\{actorName\} 的留言` : "收到新留言"/u);
  assert.match(outboxWorker, /title: "提案已達附議門檻"/u);
  assert.match(outboxWorker, /title: "提案已被刪除"/u);
  assert.match(outboxWorker, /title: "有新的公告"/u);
  assert.match(outboxWorker, /source: "broadcast"[\s\S]*type: "announcement_created"/u);
  assert.match(outboxWorker, /title: "收到新留言"/u);
  assert.match(outboxWorker, /return text\.slice\(0, 80\)/u);
  assert.match(notificationView, /useNotificationDisplay/u);
  assert.doesNotMatch(notificationView, /return t\(notification\.title\)/u);
  assert.match(notificationDisplay, /notification\.commentTitle/u);
  assert.match(notificationDisplay, /notification\.statusChangedBody/u);
  assert.match(notificationDisplay, /LEGACY_STATUS_SUFFIX/u);
  assert.match(notificationDisplay, /resolveAuthorProfile\(notification\.actor_uid\)/u);
  assert.match(uidOnlyMigration, /drop column author_name, drop column author_photo_url/u);
  assert.match(uidOnlyMigration, /drop column actor_name, drop column actor_photo_url/u);
  assert.match(uidOnlyMigration, /payload - 'author_name' - 'author_photo_url'/u);
});

test('timestamps stay UTC at rest and render in the device time zone', async () => {
  const format = await read('src/lib/format.ts');
  const utcMigration = await read('supabase/migrations/202607180002_enforce_utc_database_timezone.sql');
  const migrationFiles = (await listFiles('supabase/migrations'))
    .filter((file) => file.pathname.endsWith('.sql'));
  const migrationSource = (await Promise.all(migrationFiles.map((file) => readFile(file, 'utf8')))).join('\n');

  assert.match(format, /resolvedOptions\(\)\.timeZone/u);
  assert.match(format, /timeZone: getDeviceTimeZone\(\)/u);
  assert.match(utcMigration, /alter database %I set timezone to %L/u);
  assert.match(utcMigration, /current_database\(\)[\s\S]*'UTC'/u);
  assert.doesNotMatch(migrationSource, /\btimestamp(?:\(\d+\))?\s+(?!with\s+time\s+zone)/iu);
});

test('private issue data and all media delivery stay behind backend authorization', async () => {
  const migration = await read('supabase/migrations/202607050001_supabase_baseline.sql');
  const mediaMigration = await read('supabase/migrations/202607230003_unified_media_gateway.sql');
  const uploads = await read('supabase/functions/backendAction/uploads.ts');
  const mediaDelivery = await read('supabase/functions/_shared/media-delivery.ts');
  const workerMedia = await read('cloudflare/src/media.ts');
  const support = await read('supabase/functions/backendAction/issue-support.ts');

  assert.match(migration, /revoke all on app_api\.issues from anon, authenticated/u);
  assert.match(mediaMigration, /drop column delivery_url,[\s\S]*drop column delivery_url_expires_at,[\s\S]*drop column delivery_url_scope/u);
  assert.doesNotMatch(mediaMigration, /expired_upload_delivery_urls_cleared/u);
  assert.match(uploads, /async function resolveUploadAccessBatch/u);
  assert.match(uploads, /canReadIssue\(issue, auth\)/u);
  assert.match(uploads, /issue\.read_access === "owner-admin"/u);
  assert.match(uploads, /createMediaDeliveryUrls\(upload\.cloudinary_public_id, access\.privateDelivery\)/u);
  assert.match(mediaDelivery, /PRIVATE_MEDIA_LIFETIME_SECONDS = 15 \* 60/u);
  assert.match(workerMedia, /verifyMediaToken\(token, env\.EDGE_ORIGIN_SECRET\)/u);
  assert.match(workerMedia, /cloudinarySourceUrl\(payload\.publicId, env\)/u);
  assert.match(workerMedia, /x-novae-media-cache/u);
  assert.match(support, /storedIssue\.response_deadline_days/u);
  assert.match(support, /issue\.support_enabled !== true/u);
});

test('Markdown upload images support batch cache bypass for expired URLs', async () => {
  const uploads = await read('src/services/uploads.ts');
  const resolvedMarkdown = await read('src/composables/useResolvedMarkdown.ts');
  const markdownRenderer = await read('src/components/MarkdownRenderer.vue');

  assert.match(uploads, /resolveUploadImageUrls\(uploadIds: string\[\], options/u);
  assert.match(uploads, /forceRefresh/u);
  assert.match(uploads, /invalidateResolvedUploadCache/u);
  assert.match(resolvedMarkdown, /refreshUploadImageUrl/u);
  assert.match(resolvedMarkdown, /expiresAtByUploadId/u);
  assert.match(markdownRenderer, /@error\.capture/u);
  assert.match(markdownRenderer, /@click\.capture/u);
});

test('notification realtime subscriptions use authorized private broadcasts', async () => {
  const notificationsComposable = await read('src/composables/useNotifications.ts');
  const notificationsService = await read('src/services/notifications.ts');
  const realtimeEvents = await read('src/services/realtime-events.ts');
  const supabaseClient = await read('src/lib/supabase.ts');
  const supabaseAuth = await read('src/services/supabase-auth.ts');
  const supabaseConfig = await read('supabase/config.toml');
  const backendDeploy = await read('.github/workflows/deploy-backend.yml');
  const appResume = await read('src/composables/useAppResume.ts');
  const realtimeMigration = await read('supabase/migrations/202607150001_rate_limit_cost_hardening.sql');
  const backendAuth = await read('supabase/functions/backendAction/auth.ts');

  assert.match(notificationsComposable, /let initialized = false/u);
  assert.match(notificationsComposable, /ensureNotificationsInitialized/u);
  assert.match(notificationsComposable, /registerAppResumeHandler\(reconnectNotificationsAfterResume\)/u);
  assert.match(notificationsComposable, /NOTIFICATION_RESUME_RECONNECT_MS = 10 \* 60_000/u);
  assert.match(notificationsComposable, /fetchNotificationSnapshot\(activeSources\.value, uid, controller\.signal\)/u);
  assert.doesNotMatch(notificationsComposable, /setInterval/u);
  assert.doesNotMatch(notificationsComposable, /onScopeDispose\(clearSubscriptions\)/u);
  assert.match(notificationsService, /config: \{ private: true \}/u);
  assert.match(notificationsService, /'notification_insert' \| 'notification_state_changed'/u);
  assert.doesNotMatch(notificationsService, /postgres_changes/u);
  assert.match(notificationsService, /await authorizeSupabaseRealtime\(\)[\s\S]*client\.channel/u);
  assert.match(realtimeEvents, /await authorizeSupabaseRealtime\(\)[\s\S]*\.channel\(topic/u);
  assert.match(supabaseClient, /authorizeSupabaseRealtime[\s\S]*await client\.realtime\.setAuth\(\)/u);
  assert.match(supabaseClient, /let realtimeAuthPromise: Promise<boolean> \| null/u);
  assert.match(supabaseAuth, /clearFirebaseIdTokenCache\(\)/u);
  assert.match(
    supabaseConfig,
    /\[auth\.third_party\.firebase\][\s\S]*enabled = true[\s\S]*project_id = "env\(FIREBASE_PROJECT_ID\)"/u,
  );
  assert.match(
    backendDeploy,
    /Synchronize Firebase third-party authentication[\s\S]*node scripts\/sync-supabase-firebase-auth\.mjs/u,
  );
  assert.doesNotMatch(backendDeploy, /supabase config push/u);
  assert.match(realtimeMigration, /revoke select on app_private\.notifications from authenticated/u);
  assert.match(realtimeMigration, /realtime\.topic\(\) = 'notifications:user:' \|\| app_private\.firebase_uid\(\)/u);
  assert.match(notificationsComposable, /insertRealtimeNotification/u);
  assert.doesNotMatch(notificationsComposable, /isPersonalNotificationVisible/u);
  assert.match(realtimeMigration, /app_private\.is_expected_firebase_project\(\)/u);
  assert.match(backendAuth, /firebase_project_id: requireEnv\("FIREBASE_PROJECT_ID"\)/u);
  assert.match(appResume, /export function registerAppResumeHandler/u);
});

test('app updates hand over the service worker with bounded reload recovery', async () => {
  const appUpdate = await read('src/composables/useAppUpdate.ts');
  const appUpdateGate = await read('src/components/AppUpdateGate.vue');
  const main = await read('src/main.ts');
  const serviceWorker = await read('src/sw.ts');
  const realtimeEvents = await read('src/services/realtime-events.ts');

  assert.match(appUpdate, /SERVICE_WORKER_PREPARE_TIMEOUT_MS = 2_000/u);
  assert.match(appUpdate, /VERSION_CHECK_TIMEOUT_MS = 2_000/u);
  assert.match(appUpdate, /MAX_AUTO_RELOAD_ATTEMPTS = 2/u);
  assert.match(appUpdate, /waitForServiceWorkerTakeover/u);
  assert.match(appUpdate, /registration\.waiting\?\.postMessage\(\{ type: 'SKIP_WAITING' \}\)/u);
  assert.match(appUpdate, /serviceWorker\.register\('\/sw\.js',[\s\S]*type: 'module'/u);
  assert.doesNotMatch(appUpdate, /navigator\.serviceWorker\.ready/u);
  assert.match(appUpdateGate, /reloadApp\(\{ automatic: true, reason: 'update' \}\)/u);
  assert.match(main, /const updateRequired = await initializeAppUpdate\(\);[\s\S]*if \(updateRequired\)[\s\S]*createApp\(AppUpdateGate\)\.mount\('#app'\);[\s\S]*return;[\s\S]*initializeSession\(\)/u);
  assert.match(appUpdate, /RELOAD_RECOVERY_TIMEOUT_MS = 10_000/u);
  assert.match(serviceWorker, /event\.data[\s\S]*SKIP_WAITING/u);
  assert.match(realtimeEvents, /config: \{ private: true \}/u);
  assert.match(realtimeEvents, /event: 'content_changed'/u);
});

test('Google login uses GIS Token Client with Firebase credential in production', async () => {
  const firebase = await read('src/lib/firebase.ts');
  const googleIdentity = await read('src/lib/google-identity.ts');
  const authActions = await read('src/composables/sessionAuthActions.ts');
  const session = await read('src/composables/useSession.ts');
  const sessionTypes = await read('src/composables/sessionTypes.ts');
  const loginPanel = await read('src/components/LoginPanel.vue');
  const loginButton = await read('src/components/ui/molecules/GoogleLoginButton.vue');
  const envExample = await read('.env.example');
  const hostingWorkflow = await read('.github/workflows/deploy-frontend.yml');
  const vercelJson = await read('vercel.json');

  assert.match(firebase, /browserPopupRedirectResolver/u);
  assert.match(firebase, /popupRedirectResolver: browserPopupRedirectResolver/u);
  assert.match(googleIdentity, /accounts\.google\.com\/gsi\/client/u);
  assert.match(googleIdentity, /initTokenClient/u);
  assert.match(googleIdentity, /requestAccessToken/u);
  assert.match(googleIdentity, /prompt: 'select_account'/u);
  assert.match(googleIdentity, /shouldRetryGoogleAccessToken/u);
  assert.match(googleIdentity, /return requestGoogleAccessTokenOnce\(options\)/u);
  assert.match(authActions, /requestGoogleAccessToken/u);
  assert.match(authActions, /GoogleAuthProvider\.credential\(null, accessToken\)/u);
  assert.match(authActions, /signInWithCredential\(firebaseAuth, credential\)/u);
  assert.match(authActions, /VITE_FIREBASE_AUTH_EMULATOR_URL/u);
  assert.match(authActions, /await signInWithPopup\(firebaseAuth/u);
  assert.match(authActions, /VITE_GOOGLE_CLIENT_ID/u);
  assert.match(authActions, /auth\.loginWidgetInitFailed/u);
  assert.match(loginPanel, /<GoogleLoginButton :loading="loginBusy" @login="login"/u);
  assert.match(loginButton, /@click="emit\('login'\)"/u);
  assert.match(loginButton, /:busy="Boolean\(loading\)"[\s\S]*busy-label="[^"]*auth\.signingIn/u);
  assert.match(session, /loginBusy: computed\(\(\) =>[\s\S]*roleLoading/u);
  assert.match(session, /background supabase auth initialization failed[\s\S]*state\.error = 'auth\.initializationFailed'/u);
  assert.doesNotMatch(session, /background supabase auth initialization failed[\s\S]{0,180}rejectCurrentUser/u);
  assert.doesNotMatch(session, /redirectRecovering/u);
  assert.doesNotMatch(sessionTypes, /redirectRecovering/u);
  assert.doesNotMatch(authActions, /signInWithRedirect/u);
  assert.doesNotMatch(authActions, /getRedirectResult/u);
  assert.doesNotMatch(authActions, /novae:google-redirect-pending/u);
  assert.doesNotMatch(session, /getRedirectResult|signInWithRedirect|isGoogleRedirectPending|recoverPendingGoogleRedirect/u);
  assert.match(envExample, /VITE_GOOGLE_CLIENT_ID=/u);
  assert.match(hostingWorkflow, /VITE_GOOGLE_CLIENT_ID/u);
  assert.match(vercelJson, /https:\/\/accounts\.google\.com/u);
});

test('push notification registration recovers without overriding an explicit opt-out', async () => {
  const pushNotifications = await read('src/composables/usePushNotifications.ts');
  const pushPrompt = await read('src/composables/usePushPermissionPrompt.ts');
  const promptDialog = await read('src/components/PushPermissionPromptDialog.vue');

  assert.match(pushPrompt, /PUSH_PROMPT_COOLDOWN_MS/u);
  assert.match(pushPrompt, /needsRegistrationRepair/u);
  assert.match(pushPrompt, /useAppResume\(\(\) =>/u);
  assert.match(pushPrompt, /mode\.value = 'repair'/u);
  assert.match(pushNotifications, /needsRegistrationRepair/u);
  assert.match(pushNotifications, /preference\.deviceEnabled[\s\S]*!registrationIsFresh\(uid\)/u);
  assert.match(pushNotifications, /registerCurrentPushToken\(currentToken\)/u);
  assert.match(pushNotifications, /PUSH_REGISTRATION_SYNC_TTL_MS = 7 \* 24 \* 60 \* 60_000/u);
  assert.match(pushNotifications, /setExplicitlyDisabled\(true\)/u);
  assert.match(pushNotifications, /setExplicitlyDisabled\(false\)/u);
  assert.match(promptDialog, /app\.install\.reEnablePushNotifications/u);
});

test('notification navigation verifies target access before routing', async () => {
  const navigation = await read('src/composables/useNotificationNavigation.ts');
  const notificationsView = await read('src/views/NotificationsView.vue');
  const notificationDisplay = await read('src/composables/useNotificationDisplay.ts');
  const issueRead = await read('supabase/functions/backendAction/issue-read.ts');
  const issueReadMigration = await read('supabase/migrations/202607080002_backend_issue_read_rpc.sql');

  assert.match(navigation, /await fetchIssueRecordById\(notification\.target_id\)/u);
  assert.match(navigation, /filter: issue\.category/u);
  assert.match(navigation, /notification\.type === 'issue_deleted'/u);
  await assert.rejects(read('src/components/NotificationBell.vue'));
  assert.match(notificationsView, /useNotificationDisplay/u);
  assert.match(notificationDisplay, /notification\.commentTitle/u);
  assert.match(notificationDisplay, /notification\.statusChangedBody/u);
  assert.match(issueRead, /review_required_categories: policy\.reviewRequiredCategoryIds/u);
  assert.match(issueRead, /rpc\("backend_get_issue"/u);
  assert.match(issueReadMigration, /author_uid = actor_uid/u);
  assert.match(issueReadMigration, /status in \('under-review', 'review-rejected'\)/u);
});

test('cost-sensitive hot paths use aggregation, patching, and lazy startup', async () => {
  const supportMigration = await read('supabase/migrations/202607110001_cost_perf_support_notion.sql');
  const realtimeMigration = await read('supabase/migrations/202607110003_realtime_patch_operations.sql');
  const dashboardMigration = await read('supabase/migrations/202607110005_dashboard_counters.sql');
  const cleanupMigration = await read('supabase/migrations/202607110006_remove_obsolete_runtime_data.sql');
  const topicMigration = await read('supabase/migrations/202607110007_push_topic_state.sql');
  const board = await read('src/composables/useIssueBoardData.ts');
  const appShell = await read('src/components/AppShell.vue');
  const firebase = await read('src/lib/firebase.ts');
  const messaging = await read('src/lib/firebase-messaging.ts');
  const fcm = await read('supabase/functions/_shared/fcm.ts');
  const uploads = await read('supabase/functions/backendAction/uploads.ts');
  const vite = await read('vite.config.ts');
  const sessionBootstrap = await read('src/services/session-bootstrap.ts');
  const edgeBootstrap = await read('supabase/functions/backendAction/session-bootstrap.ts');
  const requestCostMigration = await read('supabase/migrations/202608080001_reduce_runtime_requests_and_background_cost.sql');
  const actionRegistry = await read('supabase/functions/backendAction/action-registry.ts');
  const session = await read('src/composables/useSession.ts');

  assert.match(supportMigration, /locked_until/u);
  assert.match(supportMigration, /claimed_updated_at/u);
  assert.match(realtimeMigration, /add column if not exists op/u);
  assert.match(board, /fetchIssueRecordById/u);
  assert.doesNotMatch(board, /scheduleRealtimeRefresh/u);
  assert.match(appShell, /useNotificationBadge/u);
  assert.doesNotMatch(firebase, /firebase\/messaging/u);
  assert.match(messaging, /import\('firebase\/messaging'\)/u);
  assert.match(vite, /firebase-messaging-\*\.js/u);
  assert.match(vite, /firebase-app-check-\*\.js/u);
  assert.match(fcm, /srp-broadcast/u);
  assert.match(fcm, /iid\/v1/u);
  assert.match(topicMigration, /topic_broadcast/u);
  assert.match(uploads, /resolveUploadAccessBatch/u);
  assert.match(uploads, /select\("id,category,status,author_uid,read_access,author_visible"\)/u);
  assert.match(dashboardMigration, /platform_category_counters/u);
  assert.doesNotMatch(dashboardMigration, /from app_private\.issues group by category\) grouped/u);
  assert.match(cleanupMigration, /support\.created/u);
  assert.match(cleanupMigration, /drop column if exists secure_url/u);
  assert.match(actionRegistry, /action\("getSessionBootstrap", "user", "read"/u);
  assert.match(edgeBootstrap, /backend_get_session_bootstrap_snapshot/u);
  assert.doesNotMatch(edgeBootstrap, /loadCategoryCatalog|loadContentVersions|backend_get_notification_unread_hint/u);
  assert.match(requestCostMigration, /last_seen_at <= now\(\) - interval '24 hours'/u);
  assert.match(requestCostMigration, /backend_list_issues_snapshot/u);
  assert.match(requestCostMigration, /backend_list_facilities_snapshot/u);
  assert.match(requestCostMigration, /backend_list_announcements_snapshot/u);
  assert.match(requestCostMigration, /'\*\/5 \* \* \* \*'/u);
  assert.match(sessionBootstrap, /getSessionBootstrap/u);
  assert.match(session, /fetchSessionBootstrap/u);
  assert.doesNotMatch(session, /recordPlatformVisitOnLogin/u);
});

test('content reads persist by account and invalidate after writes or realtime events', async () => {
  const persistentCache = await read('src/lib/persistent-cache.ts');
  const contentCache = await read('src/services/content-read-cache.ts');
  const sessionEffects = await read('src/composables/sessionEffects.ts');
  const issuePages = await read('src/services/issues-read-pages.ts');
  const announcements = await read('src/services/announcements.ts');
  const facilities = await read('src/services/facilities.ts');
  const notifications = await read('src/services/notifications.ts');
  const realtime = await read('src/services/realtime-events.ts');
  const backendAction = await read('src/services/backend-action.ts');

  assert.match(persistentCache, /indexedDB\.open/u);
  assert.match(persistentCache, /createIndex\('scope'/u);
  assert.match(persistentCache, /deletePersistentCacheIfVersion/u);
  assert.match(persistentCache, /entry\?\.writeVersion === writeVersion/u);
  assert.match(contentCache, /CONTENT_READ_CACHE_TTL_MS = 30 \* 24 \* 60 \* 60/u);
  assert.match(contentCache, /getCachedContentPersistent/u);
  assert.match(contentCache, /function rememberContentCacheEntry/u);
  assert.match(contentCache, /cache\.delete\(key\);[\s\S]*cache\.set\(key, entry\)/u);
  assert.match(contentCache, /leastRecentlyUsedKey/u);
  assert.match(contentCache, /runCoalescedContentRequest/u);
  assert.match(contentCache, /pendingInvalidations/u);
  assert.match(contentCache, /interface ContentCacheWriteGuard/u);
  assert.match(contentCache, /scopeVersion \+= 1/u);
  assert.match(contentCache, /invalidationVersions/u);
  assert.match(contentCache, /isContentCacheWriteGuardCurrent\(guard\)/u);
  assert.match(contentCache, /setCachedContentFromRead/u);
  assert.match(contentCache, /pendingPersistentReads\.get\(persistentKey\) === pending/u);
  assert.match(contentCache, /pendingRequests\.get\(scopedRequestKey\) === pending/u);
  assert.match(contentCache, /deletePersistentCacheIfVersion\(persistentKey, writeVersion\)/u);
  assert.match(contentCache, /subscribeContentCacheInvalidations/u);
  assert.match(contentCache, /notifyContentCacheInvalidation\(prefix\)/u);
  assert.match(contentCache, /invalidationListeners\.forEach[\s\S]*try \{[\s\S]*listener\(prefix\)[\s\S]*catch/u);
  assert.match(sessionEffects, /setContentCacheScope\(uid\)/u);
  assert.match(issuePages, /getCachedContentPersistent/u);
  assert.match(announcements, /getCachedContentPersistent/u);
  assert.match(facilities, /getCachedContentPersistent/u);
  assert.match(notifications, /NOTIFICATION_HINT_CACHE_TTL_MS/u);
  for (const service of [issuePages, announcements, facilities, notifications]) {
    assert.match(service, /setCachedContentFromRead/u);
  }
  assert.match(realtime, /invalidateRealtimeContent/u);
  assert.match(backendAction, /auth\?\.currentUser\?\.uid !== requestUid/u);
});

test('content versions batch validation and searches only submit explicitly', async () => {
  const versions = await read('src/services/content-versions.ts');
  const versionMigration = await read('supabase/migrations/202608050002_content_versions.sql');
  const actionRegistry = await read('supabase/functions/backendAction/action-registry.ts');
  const issueSearch = await read('src/composables/useIssueSearch.ts');
  const facilities = await read('src/composables/useFacilities.ts');
  const controls = await read('src/components/BoardControls.vue');

  assert.match(versions, /getContentVersions/u);
  assert.match(versions, /pendingChecks/u);
  assert.match(versions, /DOMAIN_PREFIXES/u);
  assert.match(actionRegistry, /action\("getContentVersions", "content", "read"/u);
  assert.match(versionMigration, /rename to content_versions/u);
  assert.match(versionMigration, /for each statement execute function app_private\.bump_content_version/u);
  assert.match(versionMigration, /'version'/u);
  assert.doesNotMatch(versionMigration, /realtime_events/u);
  assert.match(controls, /@submit\.prevent="emit\('submitSearch'\)"/u);
  assert.match(issueSearch, /committedSearchQuery/u);
  assert.match(facilities, /committedQuery/u);
  assert.doesNotMatch(issueSearch, /debounce|setTimeout/u);
  assert.doesNotMatch(facilities, /searchTimer|setTimeout/u);
});

test('content invalidation reaches module caches and realtime versions have one owner', async () => {
  const issueBuckets = await read('src/composables/useIssueBuckets.ts');
  const userIssues = await read('src/composables/useUserIssuesData.ts');
  const announcements = await read('src/composables/useAnnouncements.ts');
  const comments = await read('src/composables/useDiscussionComments.ts');
  const issueBoard = await read('src/composables/useIssueBoardData.ts');
  const announcementManagement = await read('src/composables/useAnnouncementManagement.ts');
  const facilities = await read('src/composables/useFacilities.ts');
  const realtime = await read('src/services/realtime-events.ts');
  const session = await read('src/composables/useSession.ts');
  const sessionEffects = await read('src/composables/sessionEffects.ts');

  assert.match(issueBuckets, /subscribeContentCacheInvalidations[\s\S]*issue-list-page\|[\s\S]*invalidateIssueBucketMemory/u);
  assert.match(issueBuckets, /function removeIssueFromBuckets[\s\S]*filter\(\(issue\) => issue\.id !== issueId\)[\s\S]*function invalidateIssueBuckets/u);
  assert.doesNotMatch(
    issueBuckets,
    /function removeIssueFromBuckets[\s\S]*bucket\.updatedAt = Date\.now\(\)[\s\S]*function invalidateIssueBuckets/u,
  );
  assert.match(userIssues, /subscribeContentCacheInvalidations[\s\S]*user-issue-list-page\|[\s\S]*invalidateUserIssueMemory/u);
  assert.match(announcements, /subscribeContentCacheInvalidations[\s\S]*announcement-list-page\|[\s\S]*state\.updatedAt = 0/u);
  assert.match(comments, /issue-comments-page\|[\s\S]*issue-comments-state[\s\S]*announcement-comments-page\|[\s\S]*announcement-comments-state/u);
  assert.match(realtime, /synchronizeRealtimeVersion\(event\)/u);
  assert.match(realtime, /hasContentVersionGap\(domain, event\.version\)[\s\S]*ensureContentVersionsFresh\(\{ notify: true \}\)/u);
  assert.match(realtime, /startContentRealtimeSession[\s\S]*realtimeSessionActive = true/u);
  assert.match(session, /startContentRealtimeSession\(\)/u);
  assert.match(sessionEffects, /stopContentRealtimeSession\(\)/u);
  for (const viewFlow of [issueBoard, announcementManagement, facilities]) {
    assert.doesNotMatch(viewFlow, /hasContentVersionGap|registerContentVersion/u);
  }
});
