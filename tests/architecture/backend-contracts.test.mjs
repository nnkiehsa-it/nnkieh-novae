import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { read, listFiles } from './helpers.mjs';

test('frontend keeps Firebase limited to Auth, App Check, and FCM', async () => {
  const srcFiles = await listFiles('src');
  const source = (await Promise.all(srcFiles.map((file) => readFile(file, 'utf8')))).join('\n');
  const firebaseRuntime = await read('src/lib/firebase.ts');
  const serviceWorker = await read('src/sw.ts');

  assert.doesNotMatch(source, /firebase\/firestore|firebase\/functions|firebase\/storage|httpsCallable|getFirestore|getFunctions|getStorage/u);
  assert.doesNotMatch(source, /firebasestorage\.googleapis|storage\.googleapis/u);
  assert.match(firebaseRuntime, /getAuth/u);
  assert.match(serviceWorker, /firebase\/messaging\/sw/u);
  assert.doesNotMatch(firebaseRuntime, /VITE_ADMIN_EMAILS|VITE_FIREBASE_STORAGE_BUCKET|VITE_FIREBASE_FUNCTIONS_REGION/u);
});

test('runtime fonts are local compressed subsets', async () => {
  const main = await read('src/main.ts');
  const style = await read('src/style.css');
  const baseStyle = await read('src/styles/base.css');
  const tailwindConfig = await read('tailwind.config.cjs');
  const viteConfig = await read('vite.config.ts');

  assert.match(main, /harmonyos-sans-webfont-splitted/u);
  assert.match(baseStyle, /jetbrains-mono-latin-400-600\.woff2/u);
  assert.match(tailwindConfig, /sans: \['HarmonyOS Sans TC', 'HarmonyOS Sans SC'/u);
  assert.doesNotMatch(tailwindConfig, /Inter/u);
  assert.doesNotMatch(viteConfig, /globPatterns:[\s\S]*woff2/u);
  assert.doesNotMatch(style, /material-symbols|Material Symbols/u);
  assert.doesNotMatch(style, /fonts\.googleapis|fonts\.gstatic|\.ttf/u);
});

test('Vercel deployment config is hosting-only', async () => {
  const vercelJson = await read('vercel.json');
  const vercelConfig = JSON.parse(vercelJson);
  const hostingWorkflow = await read('.github/workflows/deploy-frontend.yml');
  const prWorkflow = await read('.github/workflows/verify-pr.yml');

  assert.match(vercelJson, /"headers"/u);
  assert.match(vercelJson, /"rewrites"/u);
  assert.match(vercelJson, /script-src 'self' 'wasm-unsafe-eval' https:\/\/accounts\.google\.com https:\/\/apis\.google\.com https:\/\/www\.google\.com\/recaptcha\/ https:\/\/www\.gstatic\.com\/recaptcha\//u);
  assert.doesNotMatch(vercelJson, /script-src[^;]*'unsafe-eval'/u);
  const viteConfig = await read('vite.config.ts');
  assert.match(viteConfig, /`connect-src \$\{connectSources\}`/u);
  assert.match(viteConfig, /Content-Security-Policy/u);
  const globalHeaders = vercelConfig.headers.find((entry) => entry.source === '/(.*)')?.headers ?? [];
  assert.equal(globalHeaders.some((header) => header.key.toLowerCase() === 'cache-control'), false);
  assert.match(vercelJson, /\/assets\/\(\.\*\)[\s\S]*max-age=31536000, immutable/u);
  assert.match(hostingWorkflow, /npx -y vercel/u);
  assert.match(hostingWorkflow, /VITE_SUPABASE_URL/u);
  assert.match(hostingWorkflow, /VITE_SUPABASE_PUBLISHABLE_KEY/u);
  assert.doesNotMatch(hostingWorkflow, /VITE_ADMIN_EMAILS|VITE_FIREBASE_STORAGE_BUCKET|bootstrap-firebase/u);
  assert.doesNotMatch(prWorkflow, /functions\/|Firestore Rules|test:rules|firebase emulators|storage\.rules|firestore\.rules/u);
});

test('Supabase backend deployment owns database and Edge Functions', async () => {
  const workflow = await read('.github/workflows/deploy-backend.yml');
  const config = await read('supabase/config.toml');

  assert.match(workflow, /supabase\/setup-cli@v3[\s\S]*version: 2\.110\.0/u);
  assert.match(workflow, /actions\/setup-node@v7/u);
  assert.match(workflow, /cache-node-modules/u);
  assert.match(workflow, /npm ci --prefer-offline/u);
  assert.match(workflow, /npm run test:architecture/u);
  assert.match(workflow, /supabase db push/u);
  assert.match(workflow, /prepare-edge-functions\.mjs prepare/u);
  assert.match(workflow, /supabase functions deploy \$names --no-verify-jwt/u);
  assert.match(workflow, /function_namespace="n\$\{EDGE_FUNCTION_NAMESPACE\}"/u);
  assert.match(workflow, /Deploy Cloudflare API Gateway/u);
  assert.match(workflow, /wrangler@4\.111\.0 secret bulk/u);
  assert.match(workflow, /wrangler@4\.111\.0 deploy/u);
  assert.match(workflow, /for attempt in \$\(seq 1 12\)/u);
  assert.match(workflow, /"code":"origin-denied"/u);
  assert.match(workflow, /Smoke test API origin deployment/u);
  assert.match(workflow, /x-healthcheck-secret/u);
  assert.match(workflow, /x-novae-origin-secret/u);
  assert.match(workflow, /EDGE_FUNCTION_NAMESPACE/u);
  assert.match(workflow, /Run maintenance cleanup/u);
  assert.match(workflow, /function_namespace\}-maintenance/u);
  assert.match(workflow, /SUPABASE_ACCESS_TOKEN/u);
  assert.match(workflow, /CLOUDINARY_API_SECRET/u);
  assert.match(workflow, /APP_SUPABASE_SERVICE_ROLE_KEY/u);
  assert.doesNotMatch(workflow, /^\s+SUPABASE_SERVICE_ROLE_KEY=/mu);
  assert.doesNotMatch(workflow, /firebase-tools|firestore:rules|storage|Cloud Functions/u);
  assert.match(config, /\[functions\.backendAction\]/u);
  assert.match(config, /\[functions\.backendAction\]\s*verify_jwt = false/u);
  assert.match(config, /schemas = \["public", "graphql_public", "app_api", "app_private"\]/u);
});

test('Supabase schema includes RLS helpers, app tables, and hard-delete support', async () => {
  const migrations = await read('supabase/migrations/202607050001_supabase_baseline.sql');
  const runtimeConstraintMigration = await read('supabase/migrations/202607090003_harden_runtime_data_constraints.sql');
  const uploadAttachmentUuidFix = await read('supabase/migrations/202607110008_fix_upload_attachment_uuid.sql');

  assert.match(migrations, /create schema if not exists app_private/u);
  assert.match(migrations, /create schema if not exists app_api/u);
  assert.match(migrations, /auth\.firebase_uid\(\)/u);
  assert.match(migrations, /auth\.firebase_project_id\(\)/u);
  assert.match(migrations, /create table if not exists app_private\.announcements/u);
  assert.match(migrations, /create table if not exists app_private\.notifications/u);
  assert.match(migrations, /create table if not exists app_private\.push_tokens/u);
  assert.match(migrations, /create table if not exists app_private\.notion_pages/u);
  assert.match(migrations, /references app_private\.issues\(id\) on delete cascade/u);
  assert.match(migrations, /create or replace function app_api\.delete_issue/u);
  assert.match(migrations, /insert into app_private\.outbox_events/u);
  assert.match(migrations, /delete from app_private\.issues/u);
  assert.match(migrations, /for update skip locked/u);
  assert.match(migrations, /for each statement/u);
  assert.match(migrations, /alter role authenticator set pgrst\.db_schemas = 'public, graphql_public, app_api, app_private'/u);
  assert.match(migrations, /notify pgrst, 'reload config'/u);
  assert.match(migrations, /grant all privileges on all tables in schema app_private to service_role/u);
  assert.match(migrations, /alter default privileges in schema app_private/u);
  assert.match(migrations, /grant select on app_private\.notifications to authenticated/u);
  assert.match(migrations, /grant select on app_private\.notification_states to authenticated/u);
  assert.match(migrations, /alter publication supabase_realtime add table app_private\.notifications/u);
  assert.match(migrations, /alter publication supabase_realtime add table app_private\.notification_states/u);
  assert.match(migrations, /create table if not exists app_private\.idempotency_keys/u);
  assert.match(migrations, /primary key \(uid, action, request_id\)/u);
  assert.match(migrations, /create or replace function app_api\.claim_idempotency_key/u);
  assert.match(migrations, /create or replace function app_api\.complete_idempotency_key/u);
  assert.match(migrations, /create or replace function app_api\.release_idempotency_key/u);
  assert.match(migrations, /create table if not exists app_private\.push_delivery_logs/u);
  assert.match(runtimeConstraintMigration, /push_tokens_permission_check/u);
  assert.match(runtimeConstraintMigration, /permission in \('default', 'denied', 'granted'\)/u);
  assert.match(runtimeConstraintMigration, /push_tokens_length_check/u);
  assert.match(runtimeConstraintMigration, /validate constraint issues_status_check/u);
  assert.match(runtimeConstraintMigration, /validate constraint uploads_dimensions_non_negative/u);
  assert.match(runtimeConstraintMigration, /validate constraint announcements_counts_non_negative/u);
  assert.match(uploadAttachmentUuidFix, /attached_target_id = new\.id/u);
  assert.match(uploadAttachmentUuidFix, /attached_target_id = old\.id/u);
  assert.doesNotMatch(uploadAttachmentUuidFix, /attached_target_id = (?:new|old)\.id::text/u);
});

test('backendAction covers frontend actions and Cloudinary direct upload', async () => {
  const backendAction = [
    await read('supabase/functions/backendAction/index.ts'),
    await read('supabase/functions/backendAction/action-registry.ts'),
    await read('supabase/functions/backendAction/execution.ts'),
    await read('supabase/functions/backendAction/response.ts'),
    await read('supabase/functions/backendAction/auth.ts'),
    await read('supabase/functions/backendAction/users.ts'),
    await read('supabase/functions/backendAction/uploads.ts'),
    await read('supabase/functions/backendAction/issues.ts'),
    await read('supabase/functions/backendAction/issue-create.ts'),
    await read('supabase/functions/backendAction/issue-delete.ts'),
    await read('supabase/functions/backendAction/issue-comments.ts'),
    await read('supabase/functions/backendAction/issue-moderation.ts'),
    await read('supabase/functions/backendAction/issue-support.ts'),
    await read('supabase/functions/backendAction/announcements.ts'),
    await read('supabase/functions/backendAction/announcement-comments.ts'),
    await read('supabase/functions/backendAction/announcement-read.ts'),
    await read('supabase/functions/backendAction/announcement-write.ts'),
    await read('supabase/functions/backendAction/notifications.ts'),
    await read('supabase/functions/backendAction/dashboard.ts'),
  ].join('\n');
  const firebaseAuth = await read('supabase/functions/_shared/firebase-auth.ts');
  const http = await read('supabase/functions/_shared/http.ts');
  const apiErrors = await read('supabase/functions/_shared/api-errors.ts');
  const uploads = await read('src/services/uploads.ts');
  const announcementsService = await read('src/services/announcements.ts');
  const announcementLikeFixMigration = await read('supabase/migrations/202607090004_fix_announcement_like_ambiguity.sql');
  const backendActionService = await read('src/services/backend-action.ts');
  const supabaseAuthService = await read('src/services/supabase-auth.ts');
  const apiGateway = await read('src/lib/api-gateway.ts');
  const originGate = await read('supabase/functions/_shared/origin.ts');
  const session = await read('src/composables/useSession.ts');

  for (const action of [
    'getCurrentUserRole',
    'getSessionBootstrap',
    'createImageUploadSessions',
    'finalizeImageUploads',
    'deleteUploadedImages',
    'resolveUploadImageUrls',
    'createIssue',
    'deleteIssue',
    'listAnnouncements',
    'setAnnouncementLike',
    'listNotificationPages',
    'registerPushToken',
    'getPlatformDashboard',
  ]) {
    assert.match(backendAction, new RegExp(action, 'u'));
  }

  assert.match(uploads, /res\.cloudinary\.com|api\.cloudinary\.com/u);
  assert.match(uploads, /FormData/u);
  assert.match(uploads, /createImageUploadSessions/u);
  assert.match(uploads, /finalizeImageUploads/u);
  assert.match(uploads, /deleteUploadedImages/u);
  assert.doesNotMatch(uploads, /'createImageUploadSession'|'finalizeImageUpload'|'deleteUploadedImage'/u);
  assert.doesNotMatch(uploads, /firebase\/storage|uploadBytes/u);
  assert.match(session, /fetchSessionBootstrap/u);
  assert.match(session, /seedCategoryCatalog|seedSessionAccess/u);
  assert.match(backendAction, /requireVerifiedFirebaseUser/u);
  assert.doesNotMatch(backendAction, /requireEligibleFirebaseUser/u);
  assert.match(backendAction, /healthcheck/u);
  assert.match(backendAction, /x-healthcheck-secret/u);
  assert.match(backendAction, /APP_SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(backendAction, /requestId/u);
  assert.match(backendAction, /backendActionDefinitions/u);
  assert.match(backendAction, /idempotentWrite/u);
  assert.match(backendAction, /idempotentWrite\("setAnnouncementLike"/u);
  assert.match(backendAction, /async function runWithIdempotency/u);
  assert.match(backendAction, /claim_idempotency_key/u);
  assert.match(backendAction, /complete_idempotency_key/u);
  assert.match(backendAction, /release_idempotency_key/u);
  assert.match(backendAction, /successResponse/u);
  assert.match(backendAction, /errorResponse/u);
  assert.match(backendAction, /success: true/u);
  assert.match(backendAction, /success: false/u);
  assert.match(backendAction, /console\.error\(JSON\.stringify/u);
  assert.match(backendAction, /method-not-allowed/u);
  assert.match(backendAction, /readJsonRecord/u);
  assert.match(backendActionService, /getFirebaseIdToken/u);
  assert.match(backendActionService, /Authorization: `Bearer \$\{token\}`/u);
  assert.match(backendActionService, /apiGatewayUrl\('\/v1\/actions'\)/u);
  assert.doesNotMatch(backendActionService, /functions\.invoke/u);
  assert.match(backendActionService, /BackendActionEnvelope/u);
  assert.match(announcementsService, /setAnnouncementLike[\s\S]*requestId: createRequestId\(\)/u);
  assert.match(announcementLikeFixMigration, /on conflict on constraint announcement_likes_pkey/u);
  assert.match(announcementLikeFixMigration, /announcement_likes\.uid = backend_set_announcement_like\.actor_uid/u);
  assert.match(supabaseAuthService, /Authorization: `Bearer \$\{token\.token\}`/u);
  assert.match(supabaseAuthService, /apiGatewayUrl\('\/v1\/auth\/sync'\)/u);
  assert.match(apiGateway, /VITE_API_BASE_URL/u);
  assert.match(originGate, /EDGE_ORIGIN_SECRET/u);
  assert.match(backendAction, /requireOriginSecret/u);
  assert.match(firebaseAuth, /accounts:lookup/u);
  assert.match(firebaseAuth, /firebaseUser\.disabled === true/u);
  assert.match(firebaseAuth, /tokenAuthTime < tokensValidAfter/u);
  assert.match(firebaseAuth, /FIREBASE_USER_CACHE_SECONDS = 15 \* 60/u);
  assert.match(firebaseAuth, /UPSTASH_REDIS_REST_URL/u);
  assert.match(firebaseAuth, /firebaseUser = await lookupFirebaseUser[\s\S]*await cacheFirebaseUser/u);
  assert.match(firebaseAuth, /ALLOWED_DOMAIN/u);
  assert.match(http, /errorStatus/u);
  assert.match(http, /is not configured/u);
  assert.match(http, /record\.message/u);
  assert.match(http, /record\.details/u);
  assert.match(apiErrors, /request-in-progress/u);
  assert.doesNotMatch(session, /adminEmails/u);
  assert.doesNotMatch(backendAction, /max_file_size/u);
  assert.doesNotMatch(uploads, /body\.set\('max_file_size'/u);
});

test('backendAction registry owns action metadata and frontend action names', async () => {
  const registry = await read('supabase/functions/backendAction/action-registry.ts');
  const frontendContract = await read('src/services/backend-action-contract.ts');
  const workerPolicies = JSON.parse(await read('config/backend-actions.config.json'));
  const rateLimits = JSON.parse(await read('config/rate-limits.config.json'));
  const workerRateLimit = await read('cloudflare/src/rate-limit.ts');
  const index = await read('supabase/functions/backendAction/index.ts');
  const execution = await read('supabase/functions/backendAction/execution.ts');
  const serviceFiles = (await listFiles('src/services'))
    .filter((file) => !file.pathname.endsWith('/backend-action.ts'));
  const services = (await Promise.all(serviceFiles.map((file) => readFile(file, 'utf8')))).join('\n');

  assert.deepEqual(rateLimits.imageUploads, {
    issueMaxImages: 2,
    facilityMaxImages: 2,
    announcementMaxImages: 10,
    commentMaxImages: 1,
  });

  const frontendActions = [...services.matchAll(/invokeBackendAction[\s\S]*?\);/gu)]
    .map((match) => match[0].match(/(?:invokeBackendAction\(|>\()'([^']+)'/u)?.[1])
    .filter(Boolean)
    .sort();
  assert.ok(frontendActions.length > 20);
  for (const actionName of frontendActions) {
    assert.match(registry, new RegExp(`["']${actionName}["']`, 'u'));
    assert.match(frontendContract, new RegExp(`'${actionName}'`, 'u'));
  }

  const registeredActions = [...registry.matchAll(/(?:action|idempotentWrite)\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)"/gu)];
  assert.ok(registeredActions.length > 20);
  for (const [, actionName, domain, rateLimitGroup] of registeredActions) {
    assert.match(frontendContract, new RegExp(`'${actionName}'`, 'u'));
    assert.match(
      registry,
      new RegExp(`\\| "${domain}"`, 'u'),
      `${actionName} uses an unknown backend action domain`,
    );
    assert.equal(workerPolicies[actionName]?.group, rateLimitGroup, `${actionName} has a mismatched Worker rate limit group`);
  }
  for (const [actionName, policy] of Object.entries(workerPolicies)) {
    if (!policy.extraLimit) continue;
    assert.ok(rateLimits[policy.extraLimit], `${actionName} references a missing business limit`);
  }
  assert.match(workerRateLimit, /BACKEND_ACTION_POLICIES/u);
  assert.match(workerRateLimit, /claimActionRateLimit/u);

  assert.match(registry, /function idempotentWrite/u);
  assert.match(registry, /idempotent: true,\s+requiresRequestId: true/u);

  assert.match(index, /getBackendActionDefinition\(action\)/u);
  assert.match(index, /executeBackendAction\(definition, payload, auth, supabase\)/u);
  assert.match(execution, /definition\.requiredPermission && !hasPermission\(auth, definition\.requiredPermission\)/u);
  assert.match(execution, /definition\.requiresRequestId && !requestId/u);
  assert.match(registry, /updateFacilityStatus[\s\S]*requiresRequestId: true/u);
  assert.match(await read('supabase/functions/backendAction/facilities.ts'), /requireFacilityCategoryPermission/u);
  assert.match(registry, /requiredPermission: "role\.manage"/u);
  assert.doesNotMatch(registry, /requiresAdmin/u);
  assert.doesNotMatch(`${index}\n${execution}`, /const idempotentActions = new Set/u);
  assert.doesNotMatch(workerRateLimit, /const readActions = new Set/u);
  assert.doesNotMatch(workerRateLimit, /backend\.unknown/u);
});

test('outbox, webhooks, FCM, and Notion deletion marks are guarded', async () => {
  const syncUser = await read('supabase/functions/syncUser/index.ts');
  const outboxWorker = await read('supabase/functions/outboxWorker/index.ts');
  const cloudinary = await read('supabase/functions/_shared/cloudinary.ts');
  const googleOauth = await read('supabase/functions/_shared/google-oauth.ts');
  const fcm = await read('supabase/functions/_shared/fcm.ts');
  const webhook = await read('supabase/functions/_shared/webhook.ts');
  const cloudinaryWebhook = await read('supabase/functions/cloudinaryWebhook/index.ts');
  const deletionJobs = await read('supabase/functions/processDeletionJobs/index.ts');
  const maintenanceCleanup = await read('supabase/functions/maintenanceCleanup/index.ts');
  const origin = await read('supabase/functions/_shared/origin.ts');
  const notion = await read('supabase/functions/_shared/notion.ts');
  const deployBackend = await read('.github/workflows/deploy-backend.yml');

  assert.match(syncUser, /requireEligibleFirebaseUser/u);
  assert.ok(syncUser.indexOf('requireOriginSecret(request)') < syncUser.indexOf('requireEligibleFirebaseUser(request)'));
  assert.match(syncUser, /requireMethod\(request, "POST"\)/u);
  assert.match(syncUser, /firebaseAuthEmulatorHost\(\)/u);
  assert.match(syncUser, /identitytoolkit\.googleapis\.com\/v1\/projects\/\$\{encodeURIComponent\(projectId\)\}\/accounts:update/u);
  assert.doesNotMatch(syncUser, /LOCAL_TEST_MODE[^\n]*!== "true"/u);
  assert.match(outboxWorker, /requireBearerSecret/u);
  assert.ok(outboxWorker.indexOf('requireOriginSecret(request)') < outboxWorker.indexOf('requireBearerSecret(request)'));
  assert.match(outboxWorker, /requireMethod\(request, "POST"\)/u);
  assert.match(outboxWorker, /errorMessage/u);
  assert.match(outboxWorker, /claim_outbox_events/u);
  assert.match(outboxWorker, /batch_size: 10/u);
  assert.match(deletionJobs, /batch_size: 10/u);
  const usageHardening = await read('supabase/migrations/202607100004_security_usage_hardening.sql');
  assert.match(usageHardening, /current_setting\('app\.outbox_worker_signaled', true\)/u);
  assert.match(usageHardening, /current_setting\('app\.deletion_worker_signaled', true\)/u);
  assert.match(usageHardening, /set_config\('app\.deletion_worker_signaled', '1', true\)/u);
  assert.match(usageHardening, /create or replace function app_api\.resignal_background_worker/u);
  assert.match(usageHardening, /jobname = 'srp_retry_background_workers'/u);
  assert.match(usageHardening, /'\* \* \* \* \*'/u);
  assert.match(outboxWorker, /rpc\("resignal_background_worker", \{ worker_name: "outbox" \}\)/u);
  assert.match(deletionJobs, /rpc\("resignal_background_worker", \{ worker_name: "deletion" \}\)/u);
  assert.match(outboxWorker, /sendFcmMessage/u);
  assert.match(outboxWorker, /push_delivery_logs/u);
  assert.match(outboxWorker, /push_comments_enabled/u);
  assert.match(outboxWorker, /markMappedNotionPageDeleted/u);
  assert.doesNotMatch(outboxWorker, /event_id.*request\.json/u);
  assert.match(cloudinary, /image\/destroy/u);
  assert.match(cloudinary, /createCloudinaryUploadSignature/u);
  assert.match(googleOauth, /npm:google-auth-library/u);
  assert.match(googleOauth, /cachedToken/u);
  assert.match(fcm, /https:\/\/fcm\.googleapis\.com/u);
  assert.match(fcm, /\/v1\/projects\/\$\{projectId\}\/messages:send/u);
  assert.match(fcm, /FCM_EMULATOR_URL/u);
  assert.match(webhook, /x-cld-signature/u);
  assert.match(webhook, /timingSafeEqual/u);
  assert.match(cloudinaryWebhook, /verifyCloudinarySignature/u);
  assert.ok(cloudinaryWebhook.indexOf('requireOriginSecret(request)') < cloudinaryWebhook.indexOf('verifyCloudinarySignature(request, rawBody)'));
  assert.match(cloudinaryWebhook, /requireMethod\(request, "POST"\)/u);
  assert.match(deletionJobs, /deleteCloudinaryAsset/u);
  assert.match(deletionJobs, /requireMethod\(request, "POST"\)/u);
  assert.match(deletionJobs, /errorMessage/u);
  assert.match(deletionJobs, /markNotionPageDeleted/u);
  assert.match(maintenanceCleanup, /requireBearerSecret/u);
  assert.match(maintenanceCleanup, /requireMethod\(request, "POST"\)/u);
  assert.match(maintenanceCleanup, /run_maintenance_cleanup/u);
  assert.match(maintenanceCleanup, /issue_categories/u);
  assert.match(maintenanceCleanup, /valid_issue_categories/u);
  assert.match(origin, /timingSafeEqual/u);
  assert.match(origin, /EDGE_FUNCTION_NAMESPACE/u);
  assert.match(origin, /EDGE_ORIGIN_SECRET/u);
  assert.match(notion, /name: "已刪除"/u);
  assert.match(notion, /ensureSelectOption/u);
  assert.match(notion, /"分類": \{ select: \{ name: categoryLabel \} \}/u);
  assert.match(notion, /"狀態": \{ select: \{ name: statusLabel \} \}/u);
  assert.match(notion, /optionalEnv\("NOTION_ENABLED"\) === "false"/u);
  assert.match(notion, /const NOTION_API_VERSION = "2026-03-11"/u);
  assert.match(notion, /\/databases\/\$\{requireEnv\("NOTION_DATABASE_ID"\)\}/u);
  assert.match(notion, /\/data_sources\/\$\{await getDataSourceId\(\)\}/u);
  assert.match(notion, /parent: \{ type: "data_source_id", data_source_id: dataSourceId \}/u);
  assert.match(notion, /"Novae ID": \{ rich_text:/u);
  assert.match(notion, /filter: \{ property: "Novae ID", rich_text: \{ equals: externalId \} \}/u);
  assert.match(notion, /NOTION_DATA_SOURCE_ID/u);
  assert.match(notion, /NOTION_DATA_SOURCE_ID does not belong to NOTION_DATABASE_ID/u);
  assert.match(notion, /async function buildIssueManagedContent/u);
  assert.match(notion, /from\("comments"\)[\s\S]*order\("created_at", \{ ascending: true \}\)/u);
  assert.match(notion, /"審核未通過原因": richTextProperty/u);
  assert.match(notion, /"提案結果": richTextProperty/u);
  assert.match(notion, /appendContentSection\(parts, "地點", facility\.location\)/u);
  assert.match(notion, /appendContentSection\(parts, "處理結果", facility\.result_content\)/u);
  assert.doesNotMatch(outboxWorker, /syncIssueCommentToNotion/u);
  assert.doesNotMatch(notion, /callNotionAPI\(`\/databases\/[^`]+`, "PATCH"/u);
  assert.doesNotMatch(notion, /parent: \{ database_id:/u);
  assert.doesNotMatch(notion, /2022-06-28/u);
  assert.match(deployBackend, /NOTION_TOKEN and NOTION_DATABASE_ID must either both be set or both be omitted/u);
  assert.match(deployBackend, /NOTION_DATA_SOURCE_ID/u);
  assert.match(deployBackend, /NOTION_DATA_SOURCE_ID requires NOTION_TOKEN and NOTION_DATABASE_ID/u);
  assert.match(deployBackend, /NOTION_ENABLED="\$notion_enabled"/u);
  const requiredSecretBlock = deployBackend.slice(
    deployBackend.indexOf('missing=()'),
    deployBackend.indexOf('if [ "${#missing[@]}"'),
  );
  assert.doesNotMatch(requiredSecretBlock, /NOTION_TOKEN|NOTION_DATABASE_ID/u);
  assert.doesNotMatch(notion, /archived: true/u);
});

test('cost-sensitive ingress and provider operations are bounded before work', async () => {
  const backendAction = await read('supabase/functions/backendAction/index.ts');
  const worker = await read('cloudflare/src/index.ts');
  const workerRateLimit = await read('cloudflare/src/rate-limit.ts');
  const backendRateLimit = await read('supabase/functions/backendAction/rate-limit.ts');
  const workerTypes = await read('cloudflare/src/types.ts');
  const wrangler = await read('cloudflare/wrangler.toml');
  const deployBackend = await read('.github/workflows/deploy-backend.yml');
  const cloudinary = await read('supabase/functions/_shared/cloudinary.ts');
  const mediaDelivery = await read('supabase/functions/_shared/media-delivery.ts');
  const workerMedia = await read('cloudflare/src/media.ts');
  const cloudinaryWebhook = await read('supabase/functions/cloudinaryWebhook/index.ts');
  const hardening = await read('supabase/migrations/202607150001_rate_limit_cost_hardening.sql');
  const resourceHardening = await read('supabase/migrations/202607160006_resource_efficiency_hardening.sql');
  const firebaseAuth = await read('supabase/functions/_shared/firebase-auth.ts');
  const googleOauth = await read('supabase/functions/_shared/google-oauth.ts');
  const notion = await read('supabase/functions/_shared/notion.ts');
  const outboxWorker = await read('supabase/functions/outboxWorker/index.ts');
  const http = await read('supabase/functions/_shared/http.ts');
  const syncUser = await read('supabase/functions/syncUser/index.ts');
  const uploads = await read('supabase/functions/backendAction/uploads.ts');

  assert.match(cloudinary, /max_file_size/u);
  assert.match(cloudinary, /transformation: ""/u);
  assert.doesNotMatch(cloudinary, /c_limit/u);
  assert.match(mediaDelivery, /novae-media-v1/u);
  assert.match(workerMedia, /novae-media-v1/u);
  assert.match(workerMedia, /caches as CacheStorage/u);
  assert.match(workerMedia, /height: 240, quality: 75, width: 320/u);
  assert.match(workerMedia, /format: 'webp'/u);
  assert.match(workerMedia, /payload\.private[\s\S]*private, no-store/u);
  assert.match(workerMedia, /MEDIA_IP_RATE_LIMITER\.limit/u);
  assert.match(uploads, /upload_preset: CLOUDINARY_IMAGE_UPLOAD_PRESET/u);
  assert.doesNotMatch(uploads, /claimFixedWindowRateLimitUnits/u);
  assert.match(backendRateLimit, /unitsPath.*payload\.images/u);
  assert.match(backendRateLimit, /claimBackendActionBusinessLimit/u);
  assert.match(backendRateLimit, /claimFixedWindowRateLimits/u);
  assert.match(googleOauth, /cachedTokens = new Map/u);
  assert.match(googleOauth, /scopeCacheKey/u);
  assert.match(resourceHardening, /backend_get_access_context/u);
  assert.match(resourceHardening, /facility_reports_title_search_trgm_idx/u);
  assert.match(resourceHardening, /outbox_events_stale_processing_idx/u);
  assert.match(resourceHardening, /deletion_jobs_active_cloudinary_unique_idx/u);
  assert.match(resourceHardening, /truncate table app_private\.realtime_events/u);
  assert.match(resourceHardening, /add column if not exists content_hash text/u);
  assert.match(notion, /mapping\.content_hash === nextContentHash/u);
  assert.match(outboxWorker, /upsert\(notifications, \{ ignoreDuplicates: true, onConflict: "id" \}\)/u);
  assert.doesNotMatch(uploads, /internal:delete-upload/u);
  assert.match(http, /readRequestText\(request: Request, maxBytes: number\)/u);
  assert.doesNotMatch(cloudinaryWebhook, /requestRateLimitIdentifier/u);
  assert.doesNotMatch(syncUser, /requestRateLimitIdentifier/u);
  assert.match(worker, /claimSyncIngress/u);
  assert.match(worker, /claimCloudinaryIngress/u);
  assert.match(worker, /claimActionIngress/u);
  assert.match(worker, /claimActionRateLimit/u);
  assert.match(workerRateLimit, /\.limit\(\{ key \}\)/u);
  assert.doesNotMatch(`${workerRateLimit}\n${workerTypes}`, /UPSTASH_REDIS/u);
  assert.match(wrangler, /\[\[env\.production\.ratelimits\]\]/u);
  assert.match(wrangler, /\[\[env\.development\.ratelimits\]\]/u);
  assert.match(wrangler, /name = "MEDIA_IP_RATE_LIMITER"/u);
  assert.match(wrangler, /\[env\.production\.observability\][\s\S]*?head_sampling_rate = 0\.1/u);
  assert.match(firebaseAuth, /FIREBASE_USER_MEMORY_CACHE_MS = 5 \* 60 \* 1000/u);
  assert.match(firebaseAuth, /cachedAtMs \+ FIREBASE_USER_CACHE_MS - Date\.now\(\)/u);
  assert.match(firebaseAuth, /JSON\.stringify\(\{ cachedAtMs, user \}\)/u);
  const gatewayDeploy = deployBackend.slice(
    deployBackend.indexOf('- name: Deploy Cloudflare API Gateway'),
    deployBackend.indexOf('- name: Smoke test Cloudflare API Gateway'),
  );
  assert.doesNotMatch(gatewayDeploy, /\$\{\{ secrets\.UPSTASH_REDIS/u);
  assert.match(gatewayDeploy, /secret delete "\$obsolete_key"/u);
  assert.match(gatewayDeploy, /CLOUDINARY_API_SECRET/u);
  assert.match(gatewayDeploy, /CLOUDINARY_CLOUD_NAME/u);
  assert.match(syncUser, /claimFixedWindowRateLimit/u);
  assert.ok(
    backendAction.indexOf('getBackendActionDefinition(action)')
      < backendAction.indexOf('requireAuth(supabase, request)'),
  );
  assert.match(backendRateLimit, /RATE_LIMITS\.issueCreateDaily/u);
  assert.match(hardening, /pg_advisory_xact_lock/u);
  assert.match(hardening, /max_devices constant integer := 10/u);
  assert.match(hardening, /revoke select on app_private\.realtime_events from authenticated/u);
  assert.doesNotMatch(hardening, /revoke select on app_api\.(?:notifications|notification_states)/u);
});

test('removed issue categories are cleaned and Notion backups are marked deleted', async () => {
  const cleanupMigration = await read('supabase/migrations/202607060002_cleanup_removed_issue_categories.sql');
  const maintenanceCleanup = await read('supabase/functions/maintenanceCleanup/index.ts');
  const workflow = await read('.github/workflows/deploy-backend.yml');

  assert.match(cleanupMigration, /valid_issue_categories text\[\]/u);
  assert.match(cleanupMigration, /where not \(category = any\(valid_issue_categories\)\)/u);
  assert.match(cleanupMigration, /attached_target_type = 'issue'/u);
  assert.match(cleanupMigration, /attached_target_type = 'comment'/u);
  assert.match(cleanupMigration, /insert into app_private\.deletion_jobs \(target_type, target_id, cloudinary_public_id\)/u);
  assert.match(cleanupMigration, /insert into app_private\.outbox_events \(event_type, target_type, target_id, actor_uid, payload\)/u);
  assert.match(cleanupMigration, /'issue\.deleted'/u);
  assert.match(cleanupMigration, /delete from app_private\.uploads/u);
  assert.match(cleanupMigration, /delete from app_private\.issues/u);
  assert.doesNotMatch(cleanupMigration, /notion_pages|notion_page_id/u);
  assert.match(maintenanceCleanup, /valid_issue_categories: \(issueCategories \?\? \[\]\)\.map/u);
  assert.match(workflow, /Run maintenance cleanup/u);
});

test('transient database tables have explicit retention coverage', async () => {
  const retentionMigration = await read('supabase/migrations/202607090006_database_retention_minimization.sql');
  const uploads = await read('supabase/functions/backendAction/uploads.ts');
  const mediaDelivery = await read('supabase/functions/_shared/media-delivery.ts');

  assert.match(retentionMigration, /alter table app_private\.notifications[\s\S]*now\(\) \+ interval '7 days'/u);
  assert.match(retentionMigration, /alter table app_private\.realtime_events[\s\S]*now\(\) \+ interval '1 day'/u);
  assert.match(retentionMigration, /alter table app_private\.idempotency_keys[\s\S]*now\(\) \+ interval '24 hours'/u);
  assert.match(retentionMigration, /create or replace function app_api\.complete_outbox_event[\s\S]*expires_at = now\(\) \+ interval '1 day'/u);
  assert.match(retentionMigration, /create or replace function app_api\.fail_outbox_event[\s\S]*expires_at = now\(\) \+ interval '3 days'/u);
  assert.match(retentionMigration, /create or replace function app_api\.complete_idempotency_key[\s\S]*expires_at = now\(\) \+ interval '24 hours'/u);

  for (const tableName of [
    'realtime_events',
    'notifications',
    'outbox_events',
    'push_delivery_logs',
    'idempotency_keys',
    'push_tokens',
    'deletion_jobs',
    'maintenance_runs',
  ]) {
    assert.match(
      retentionMigration,
      new RegExp(`(?:delete from|update) app_private\\.${tableName}`, 'u'),
      `${tableName} must be handled by maintenance cleanup`,
    );
  }

  assert.match(retentionMigration, /status = 'ready' and attached_target_id is null and updated_at < now\(\) - interval '48 hours'/u);
  assert.match(retentionMigration, /status = 'failed' and updated_at < now\(\) - interval '24 hours'/u);
  assert.match(retentionMigration, /delivery_url_expires_at < now\(\)/u);
  assert.match(retentionMigration, /status = 'sent' and updated_at < now\(\) - interval '1 day'/u);
  assert.match(retentionMigration, /status = 'failed' and updated_at < now\(\) - interval '3 days'/u);
  assert.match(retentionMigration, /status = 'completed' and updated_at < now\(\) - interval '1 day'/u);

  assert.match(mediaDelivery, /PRIVATE_MEDIA_LIFETIME_SECONDS = 15 \* 60/u);
  assert.doesNotMatch(uploads, /delivery_url/u);
});

test('backend list actions use stable cursor pagination at the service boundary', async () => {
  const backendAction = [
    await read('supabase/functions/backendAction/utils.ts'),
    await read('supabase/functions/backendAction/issue-read.ts'),
    await read('supabase/functions/backendAction/issue-comments.ts'),
    await read('supabase/functions/backendAction/announcement-comments.ts'),
    await read('supabase/functions/backendAction/notifications.ts'),
  ].join('\n');
  const issueReadMigration = await read('supabase/migrations/202607080002_backend_issue_read_rpc.sql');
  const issuePages = await read('src/services/issues-read-pages.ts');
  const issueComments = await read('src/services/issues-read-comments.ts');
  const announcements = await read('src/services/announcements.ts');
  const notifications = await read('src/services/notifications.ts');
  const mostSupportedCursorMigration = await read('supabase/migrations/202607090002_fix_most_supported_cursor.sql');
  const alignedIssueSortMigration = await read('supabase/migrations/202607110009_align_issue_sort_cursor.sql');
  const issueSort = await read('src/lib/issue-sort.ts');

  assert.match(backendAction, /function applyDescendingDateCursor/u);
  assert.match(backendAction, /function applyAscendingDateCursor/u);
  assert.match(backendAction, /if \(action === "listIssues" \|\| action === "searchIssues"\)/u);
  assert.match(backendAction, /rpc\("backend_list_issues"/u);
  assert.match(backendAction, /rpc\("backend_list_user_issues"/u);
  assert.match(backendAction, /cursor_created_at: readCursorDate\(cursor, "created_at"\) \|\| null/u);
  assert.match(backendAction, /private_to_owner_categories: policy\.privateToOwnerCategoryIds/u);
  assert.match(issueReadMigration, /sort_name = 'most-supported'/u);
  assert.match(issueReadMigration, /sort_name = 'ending-soon'/u);
  assert.match(issueReadMigration, /cursor_id is null/u);
  assert.match(backendAction, /if \(action === "listComments"\)/u);
  assert.match(backendAction, /if \(action === "listAnnouncementComments"\)/u);
  assert.match(backendAction, /if \(action === "listNotificationPages"\)/u);
  assert.match(backendAction, /rpc\("backend_list_notifications"/u);
  assert.match(backendAction, /cursor_created_at: readCursorDate\(cursor, "createdAtMs", "created_at"\) \|\| null/u);
  assert.match(issuePages, /normalizeIssueCursor\(result\.cursor\)/u);
  assert.match(issueComments, /normalizeCommentCursor\(result\.cursor\)/u);
  assert.match(announcements, /normalizeAnnouncementCursor\(result\.cursor\)/u);
  assert.match(announcements, /normalizeCommentCursor\(result\.cursor\)/u);
  assert.match(notifications, /normalizeNotificationCursor\(page\.cursor\)/u);
  assert.match(mostSupportedCursorMigration, /effective_sort_name = 'most-supported'/u);
  assert.match(mostSupportedCursorMigration, /coalesce\(cursor_sort_date, cursor_created_at\)/u);
  assert.match(mostSupportedCursorMigration, /when effective_sort_name = 'most-supported' then last_issue -> 'created_at_ms'/u);
  assert.match(alignedIssueSortMigration, /coalesce\(last_issue -> 'review_approved_at_ms', last_issue -> 'created_at_ms'\)/u);
  assert.match(alignedIssueSortMigration, /coalesce\(review_approved_at, created_at\) < coalesce\(cursor_sort_date, cursor_created_at\)/u);
  assert.match(issueSort, /issue\.review_approved_at \?\? issue\.created_at/u);
  assert.match(issueSort, /issue\.closed_at \?\? issue\.created_at/u);
  assert.doesNotMatch(announcements, /sortNumber|most-liked|most-commented/u);
});

test('announcement comment availability is enforced by global and record-level database rules', async () => {
  const migration = await read('supabase/migrations/202608040001_announcement_comment_global_setting.sql');
  const commentAction = await read('supabase/functions/backendAction/announcement-comments.ts');
  const detailActions = await read('src/components/AnnouncementDetailActions.vue');

  assert.match(migration, /enforce_announcement_comment_availability/u);
  assert.match(migration, /new\.comments_override is true[\s\S]*raise exception 'comments-disabled'/u);
  assert.match(migration, /prevent_announcement_comment_when_disabled[\s\S]*setup\.announcement_comments_enabled/u);
  assert.match(migration, /when new\.announcement_comments_enabled then coalesce\(announcement\.comments_override,\s*true\)/u);
  assert.match(commentAction, /announcement_comments_enabled[\s\S]*throw new Error\("comments-disabled"\)/u);
  assert.match(detailActions, /comments_globally_enabled[\s\S]*comments\.closedByGlobalSetting/u);
});
