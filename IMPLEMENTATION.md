# Performance, cost, and customization implementation

This file is the source of truth for the implementation approved on 2026-08-23. Keep it updated as work lands so the scope survives long-running task compaction.

## Product direction

- Preserve the current information architecture, routes, labels, brand, light/dark themes, and permission model.
- Make the product feel faster without removing prefetching that measurably reduces navigation latency.
- Increase app-like motion and tactile feedback. Motion must communicate navigation depth, state change, or direct manipulation, animate compositor-safe properties, and respect reduced-motion preferences.
- Keep notification delivery realtime.
- Do not change Notion behavior, retention, or synchronization.
- Platform super administrators remain controlled only by the backend `ADMIN_EMAILS` environment variable.

## Approved work

### P0

- [x] Bound and prune the browser persistent content cache by age, entry count, and approximate byte budget.
- [x] Delete expired persistent entries when they are encountered.
- [x] Remove the full HarmonyOS font set from service-worker precaching while preserving normal unicode-range loading.
- [x] Add operational recovery for failed media deletion jobs: list, retry, outcome, and tests.
- [x] Add impact estimates before destructive retention or bulk feature-policy changes.
- [x] Run high-cost policy changes as bounded background batches with progress and final results.
- [x] Prevent retention changes from causing an unbounded single maintenance transaction.

### Selected P1

- [x] Keep notifications realtime.
- [x] Connect other realtime content only on routes that need it; share one browser connection across subscribed topics.
- [x] Narrow broad session/realtime subscriptions so unrelated UI does not rerender.
- [x] Navigate immediately from notifications and resolve target data on the destination route.
- [x] Retain only a bounded number of feed pages in memory and in the DOM.
- [x] Improve startup and route loading while retaining intent-driven prefetches that reduce navigation latency.
- [x] Load the existing Managed Turnstile script before hydration, preconnect its origin, and overlap Firebase token validation with the unchanged Siteverify gate.
- [x] Suspend realtime after 30 minutes without meaningful activity; resume and resynchronize on interaction or foreground return.
- [x] Convert global category or comment policy changes that touch many rows into estimated, observable background batches.
- [x] Strengthen route, panel, control, and list motion so navigation feels app-like without delaying resolved content.

### Runtime customization

- [x] Move business retention policies into platform runtime settings: announcements, notifications, realtime events, outbox, push delivery records, idempotency records, inactive push tokens, push confirmation, inactive avatars, inactive profile PII, expired restrictions, deletion jobs, maintenance runs, role/category/access audits, and upload lifecycle.
- [x] Give independently destructive content policies explicit enable switches.
- [x] Preserve hard technical and security ceilings in code or deployment configuration.
- [x] Keep cron cadence, queue concurrency, backend timeouts, secrets, routes, storage paths, RLS, and `ADMIN_EMAILS` outside runtime admin control.

## Explicit exclusions

- Notion integration and Notion data lifecycle.
- Removing prefetch solely to reduce request counts. Prefetch changes require navigation-latency evidence.
- Making platform-super-admin assignment editable in the UI or database.
- Changing routes, storage paths, deployment names, or existing permission scopes.

## Verification

- [x] Unit tests for persistent-cache eviction and feed retention.
- [x] Integration tests with successful and rejected backend actions for new deletion and batch-job actions.
- [x] Allowed and denied tests for role-sensitive actions; the new actions are platform-scoped and expose no cross-scope selector.
- [x] Browser checks for desktop/mobile loading, notification navigation, management progress, and reduced motion; the final clean Playwright run passes all 16 journeys.
- [x] `npm run check:unused`.
- [x] `npm run verify:local`.
- [x] `npm run verify:integration`.
- [x] `npm run verify:all`.

## Implementation log

- 2026-08-23: Scope recorded. Notion excluded.
- 2026-08-23: Persistent cache bounded to 30 days, 500 entries, and 16 MiB; expired reads delete their stored record.
- 2026-08-23: Service-worker precaching excludes WOFF2 font shards while normal runtime unicode-range loading remains active.
- 2026-08-23: Content and notification feeds retain at most five pages; realtime notification inserts use the same item ceiling.
- 2026-08-23: Failed Cloudinary media deletions are visible in system management and can be requeued by role managers; Worker and database permissions plus success/rejection assertions passed `verify:integration`. Notion fields and behavior remain untouched.
- 2026-08-23: Global announcement/issue comment-policy propagation now estimates affected rows, requires impact confirmation, processes at most 100 rows per Queue turn, and reports progress/result through observable platform jobs.
- 2026-08-23: All approved retention periods are runtime settings. User/content deletion policies have explicit switches; operational/audit tables retain mandatory bounded cleanup. Scheduled cleanup is an observable bounded background job, and the runtime push-token confirmation interval reaches the browser through session bootstrap.
- 2026-08-23: Notifications remain globally realtime while issues, facilities, and announcements subscribe only on their route families. Issue support memory no longer lives in the reactive session provider, avoiding app-wide rerenders.
- 2026-08-23: Notification navigation no longer waits for a target lookup. Destination routes resolve their own data, with intent-driven hover/focus prefetch retained for lower perceived latency.
- 2026-08-23: Route depth transitions, immediate navigation selection, interactive-card press feedback, and active-icon movement are more pronounced while staying compositor-safe and reduced-motion aware.
- 2026-08-23: `verify:local` passes all 12 stages and `verify:integration` passes all 23 backend cases. The full Playwright run passes bootstrap and 10 desktop journeys; one 150-second delete-path timeout is followed by four mobile startup timeouts, so full browser verification remains open.
- 2026-08-23: The Managed Turnstile widget remains visible and keeps the original one-time token/Siteverify flow, but its script now preconnects and loads before hydration. Firebase ID-token validation starts during the Turnstile wait and is consumed only after Siteverify succeeds.
- 2026-08-23: Realtime now closes its shared browser socket after 30 minutes without meaningful activity, suppresses reconnect attempts while idle, resumes on interaction or foreground return, and deduplicates reconnect resync callbacks so missed notifications/content are refreshed once.
- 2026-08-23: A second full Playwright run passed the previously failing category and facility-scope cases but failed a different delete journey plus announcement access and the same four mobile journeys (10/16 total), confirming the remaining browser suite is state-sensitive rather than a stable regression in this change.
- 2026-08-23: Playwright trace identified the state sensitivity: Auth Emulator sessions unnecessarily initialized Firebase's Google popup/redirect resolver, delaying token readiness by roughly 7.5 seconds on every fresh context before `/v1/auth/sync` could start. Emulator mode now uses direct credential persistence without that resolver; production Google login remains unchanged, CSP stays strict, and the mobile init script runs only in the top frame.
- 2026-08-23: Restored sessions no longer repeat `/v1/auth/sync` profile writes and platform-admin reconciliation on every app start. That mutation now runs only after a newly completed login; restored sessions retain the unchanged Turnstile/Siteverify gate and proceed directly to the authoritative session bootstrap.
- 2026-08-23: Content realtime has an explicit deployment switch and remains enabled by default. Browser permission journeys disable content sockets because realtime transport is covered by integration tests; notification realtime remains enabled and independent.
- 2026-08-23: The final clean Playwright run passes all 16 desktop and mobile journeys. The failures were caused by emulator-only login resolver initialization, incomplete E2E profile synchronization, unnecessary restored-session writes, and accumulated content realtime connections rather than an outdated Playwright dependency or selector set.
- 2026-08-23: `npm run verify:all` passes the complete local, integration, and end-to-end pipeline.
