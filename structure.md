# Novae repository structure

This document is the maintained map of the repository. Read it before broad searches and update it whenever files or responsibilities move.

## Runtime and entry points

- `package.json` — Node 24, Next.js 16.3, React 19.2, TypeScript 7, Tailwind CSS 4, Radix/shadcn primitives, Motion, Serwist, Vitest, and Playwright scripts.
- `src/app/` — Next App Router. Route `page.tsx` files assemble views and forward events; they do not import `services/` directly.
- `src/app/layout.tsx` — root metadata, immersive iOS viewport/status-bar configuration, Inter/Roboto Mono plus HarmonyOS Sans TC split-font loading, global providers, and global CSS.
- `src/app/globals.css` — semantic light/dark color, typography, radius, shadow, safe-area, viewport, surface tokens, the AppStart safe-area surface, and the responsive dock used by the shared discussion composer.
- `src/assets/fonts/harmonyos-sans-tc/` — generated, project-character-scoped HarmonyOS Sans TC Regular, Medium, Semibold, and Bold shards plus CSS; refreshed by `scripts/generate-harmonyos-subset.mjs`.
- `src/styles/motion.css` — transition.dev-inspired timings/easing and named recipes for routes, panels, cards, text, digits, dialogs, dropdowns, toasts, loading, and success states. Toasts use the source recipe's asymmetric 350/250ms rise, scale, and cross-blur; dialog motion is independent from its shared viewport centering positioner. Root routes use opacity-only entry while child/return routes retain spatial direction; hover-capability and reduced-motion media queries remain centralized here.
- `src/app/sw.ts` — Serwist service worker; `next.config.mjs` compiles and registers it at `public/sw.js`.
- `src/proxy.ts` — per-request nonce CSP for Next hydration, strict production script execution, and local-emulator development connections.
- `next.config.mjs` — public environment injection, static security headers, image hosts, and Serwist integration.
- `components.json` — shadcn/ui aliases and Tailwind 4 configuration.
- `vercel.json` — Vercel Next.js framework configuration.

## App Router

- `src/app/login/` — focused Google sign-in presentation with a quiet, stagger-revealed brand statement; decorative product cards stay out of the authentication path.
- `src/app/(protected)/layout.tsx` — authenticated application guard and shared shell boundary.
- `src/app/(protected)/setup/` — two-stage language and category setup; idempotent completion recovery lives in `use-initial-setup`.
- `src/app/(protected)/issues/` — feature-guarded issue redirect, feed, composer, and detail routes.
- `src/app/(protected)/facilities/` — feature-guarded facility feed, composer, and detail routes.
- `src/app/(protected)/announcements/` — announcement feed, composer, and detail routes.
- `src/app/(protected)/notifications/` — merged broadcast/admin/user notification presentation with an immediately prefetchable route-loading shell.
- `src/app/(protected)/settings/` — account, appearance, language, install, push, and resource settings with a stable prefetchable card shell.
- `src/app/(protected)/dashboard/` — animated platform statistics and operational diagnostics, with a prefetched geometry-matched `loading.tsx` shell.
- `src/app/(protected)/admin/` — unified category/feature and scoped member-access management; the management route owns a prefetched responsive loading boundary.

## Presentation components

- `src/components/ui/` — business-free shadcn/Radix primitives. Buttons, fields, overlays, tabs, sheets, menus, status badges, skeletons, page states, and the shared Novae brand lockup share global semantic tokens. `card.tsx` keeps the base card server-renderable with the low-cost transitions.dev CSS resize recipe; `resizable-card.tsx` adds opt-in Motion layout projection for cards whose intrinsic height changes in place. `skeleton-reveal.tsx` stacks a field skeleton over its final text/number slot and supplies the centered badge-label handoff used by category/status tags.
- `src/components/motion/` — reusable animated numbers, reaction feedback, and geometry-only feed wrappers. The shared reaction button owns a soft-gray active/quiet-ghost inactive hierarchy and fixed 16px icon geometry across proposal support, facility affected, and announcement like actions; reaction hooks update immediately, confirm in the background, and roll back with retry feedback on failure. Dense list items stay mounted and painted without viewport observers or offscreen opacity states.
- `src/components/app-shell.tsx` / `liquid-nav.tsx` — desktop, compact desktop, and mobile navigation. Primary navigation updates immediately while the pathname-keyed whole incoming route node fades in for 350ms only after the prior node has unmounted; no document View Transition snapshot can overlap content or cover the fixed sidebar/mobile dock. Child/back routes retain the shared depth-aware entrance motion, while selected navigation and tab surfaces use measurement-free shared-layout motion.
- `src/lib/navigation-memory.ts` — remembers the immediately preceding in-app pathname, stamps each committed in-app history entry with a monotonic index, and preserves the intended root/child/back direction until its destination pathname commits. Browser back and forward therefore resolve to opposite deterministic directions even when a loading boundary causes intermediate renders.
- `src/components/issues/` — issue cards, detail content/actions, and moderation presentation.
- `src/components/facilities/` — facility cards, shared detail content with status-aware conclusion presentation, and status-dialog presentation.
- `src/components/announcements/` — announcement cards.
- `src/components/settings/` — account, appearance/install, push preferences, and resource cards.
- `src/components/notifications/notification-skeleton.tsx` — route and local notification loading rows that share the resolved list container, padding, icon column, and text anchors.
- `src/components/dashboard/dashboard-skeleton.tsx` — geometry-matched dashboard toolbar, header, metric grid, distribution/operations columns, and failure-panel loading shell.
- `src/components/admin/administration-skeleton.tsx` — permission-matched system-management toolbar, tabs, and editor-frame loading shell used by route prefetch.
- `src/components/setup/` — setup step chrome and reusable category draft editors.
- `src/components/admin/` — category, reusable category-editor controls, and scoped-access presentation. The management surface follows a spacious choose-scope → edit → save hierarchy, uses divider-based category rows instead of nested cards, and adapts member assignment into two columns only at wide widths.
- `src/components/composer-fields.tsx` — shared title/Markdown/media composer surface.
- `src/components/discussion.tsx`, `comments/comment-composer.tsx`, `comments/comment-thread.tsx` — shared server-sorted discussion card, fixed safe-area composer with bottom-aligned 40px avatar/action geometry and symmetric inset, reply-target preview, and collapsible reply-rail presentation. The dock publishes its ResizeObserver-measured live height; detail pages consume that final clearance so mobile sidebar cards stay adjacent to discussion while the last page content can always scroll fully above the composer.
- `src/components/content-author.tsx` — shared author avatar and name row for list/detail content; unresolved profiles reserve a 24px avatar plus 64px mixed-script name skeleton and never flash a generic member label.
- `src/components/content-renderer.tsx` — sanitized Markdown/media rendering; its optional field-level reveal affects Markdown text only and leaves media/card chrome outside the filter layer.
- `src/components/content-resolution-notice.tsx` / `content-resolution-notice-skeleton.tsx` — shared success/error conclusion block for proposals and facility reports, paired with a lightweight cold-load skeleton that does not pull Markdown rendering into route fallbacks; the resolved block uses status-aware copy and reduced-motion-safe state entrance animation.
- `src/components/detail-toolbar.tsx` — shared, geometry-stable secondary toolbar; detail routes add share/actions while Dashboard and system management reuse the same back geometry on mobile and desktop.
- `src/components/protected-app.tsx`, `app-providers.tsx`, `app-update-gate.tsx` — startup/session, providers, theme/i18n, transitions.dev-matched pill toast boundaries, and bounded forced PWA updates with version polling, service-worker takeover, animated progress, and reload recovery.
- `src/components/feature-route-guard.tsx` — shared disabled-feature guard for direct proposal and facility routes.
- `src/components/ui/route-skeleton.tsx` and route `loading.tsx` files — prefetched list/detail app-shell fallbacks that reuse the same header/grid/control geometry as their resolved routes while skeletonizing only unresolved domain fields. Feed skeletons mirror each domain card's author, progress/location, status, and interaction rows; proposal and facility detail fallbacks also reserve the shared conclusion block before the final success/error content is known, and no domain requests are started by the fallback.
- `src/components/ui/tooltip.tsx` — shared fine-pointer-only tooltip capability boundary; touch and non-hover devices keep labelled controls without opening tooltip layers.
- `src/components/ui/action-feedback-icon.tsx`, `pending-alert-dialog-action.tsx` — shared transitions.dev-style spinner-to-check primitives for backend mutation, destructive confirmation, and update feedback.

## Hooks and stateful flows

- `src/hooks/use-session.tsx` — Firebase authentication, role/permission snapshot, setup status, and supported-issue session state.
- `src/hooks/use-categories.ts` — category and platform-feature store.
- `src/hooks/use-issue-feed.ts`, `use-issue-detail.ts` — issue list/detail fetching, pagination, comments, support, and delete flows; successful deletes retain the mounted detail entity through the success hold/navigation while a shared deletion marker removes it from list snapshots, preventing a transient not-found page. Categories without comment capability short-circuit comment reads and presentation.
- `src/hooks/use-facility-feed.ts`, `use-facility-detail.ts`, `use-facility-status.ts` — facility list/detail, affected-user, delete, and moderation flows.
- `src/hooks/use-announcement-feed.ts`, `use-announcement-detail.ts` — announcement list/detail, likes, comments, and deletion.
- `src/hooks/use-notifications-page.ts`, `use-notification-badge.ts` — notification aggregation, realtime subscriptions, pagination, target routing, and unread hints.
- `src/hooks/use-route-preload.ts` — authenticated route bundle and RSC-shell warming only; static primary destinations preload at shell mount, category destinations join after category hydration, and secondary routes warm during idle time without mounting data hooks or requesting content services.
- `src/hooks/use-entry-composer.ts` — issue/facility/announcement composer workflows and upload rollback.
- `src/hooks/use-initial-setup.ts` — setup validation, persistence, polling, and retry-safe completion.
- `src/hooks/use-category-management.ts`, `use-access-management.ts` — platform configuration and category-scoped RBAC flows.
- `src/hooks/use-platform-dashboard.ts` — dashboard fetching and refresh.
- `src/hooks/use-permission-redirect.ts` — shared client-side redirect for authenticated routes that require a specific permission.
- `src/hooks/use-push-notifications.ts`, `use-pwa-install.ts` — device push preferences and install flow; settings present each push write through the shared targeted spinner-to-check lifecycle.
- `src/hooks/use-image-attachments.ts`, `use-resolved-markdown.ts`, `use-public-profiles.ts`, `use-cold-data-reveal.ts` — reusable media, Markdown, synchronous public-profile memory hydration, and one-shot cold-data reveal helpers. A resolved reveal retires after its 400ms handoff so cached or later state changes render directly.
- `src/hooks/use-content-invalidation-refresh.ts`, `use-action-feedback.ts` — shared stale-cache refresh wiring and 500 ms successful-action feedback lifecycle.

## Data, domain, and infrastructure

- `src/services/` — frontend boundary for the Cloudflare Workers API, native WebSocket realtime transport, uploads, Firebase-backed sessions, and backend actions. Only hooks and other services import it; no browser database client exists.
- `src/lib/` — framework-independent request, Firebase, caching, Markdown, image, route, formatting, pagination, and domain utilities.
- `src/hooks/use-paged-request-guard.ts` — shared feed request generation/in-flight guard that prevents duplicate loads and stale query responses from committing.
- `src/lib/content-entity-store.ts` and `src/hooks/use-content-entity.ts` — normalized user-scoped content entities shared by lists, details, mutations, and realtime; explicit issue/announcement summary types omit full bodies and cannot satisfy or overwrite authoritative detail reads, while field revisions prevent older requests from replacing newer optimistic, server-confirmed, or realtime patches.
- `src/lib/reaction-state.ts` — shared pure optimistic reaction state transition used by proposal support, facility affected, and announcement like flows so immediate counts and rollback snapshots follow one rule.
- `src/lib/view-memory-cache.ts` — bounded 30-minute, user-scoped LRU snapshots for primary list/query UI, pagination and dashboard state; hooks repaint cached views synchronously, refresh through existing services, and clear snapshots with the active session.
- `src/lib/loading-timing.ts` — shared cold-skeleton minimum duration; cached views bypass it while genuinely unresolved backend reads avoid one-frame loading flashes.
- `src/constants/` — generated/static application, category, status, retention, API error, and rate-limit constants.
- `src/types/` — shared frontend/domain types.
- `src/i18n/` — reactive React i18n store and paired `en` / `zh-TW` domain catalogs. `ui.ts` contains the rebuilt interface language.
- `src/generated/` — generated frontend contracts; do not edit manually.
- `cloudflare/src/index.ts` — sole public API entrypoint for actions, auth sync, realtime tickets/WebSockets, signed media, Cloudinary webhooks, Queue consumption, and scheduled maintenance.
- `cloudflare/src/backend/actions/` — generated-registry-driven action dispatch and domain workflows. Authorization is enforced here and in database functions, never by frontend visibility checks.
- `cloudflare/src/backend/database/` — parameterized PostgreSQL adapter and schema names used through the request-scoped Hyperdrive connection.
- `cloudflare/src/backend/jobs/` — durable outbox, FCM/Notion delivery, deletion, realtime fan-out, and maintenance consumers driven by Cloudflare Queues.
- `cloudflare/src/backend/shared/` — Worker environment, Firebase token validation, Cloudinary, FCM, Notion, HTTP, media, and structured-observability boundaries.
- `cloudflare/src/durable/` — SQLite-backed business rate limits and WebSocket Hibernation realtime hub. Realtime state can reconnect from PostgreSQL content versions instead of becoming a source of record.
- `cloudflare/wrangler.json` — local/default Worker bindings for Hyperdrive, Queue, Durable Objects, cron, native rate limits, observability, and Smart Placement; deployment renders an ignored environment-specific copy.
- `database/migrations/` — fresh PostgreSQL 17 baseline and append-only migrations for Neon. `0002` creates private/API schemas, `0003` completes realtime batches, `0004` seals the Worker-only database boundary, and `0005` exposes scheduled support expiry.
- `database/seed.local.sql` / `seed.integration.sql` — deterministic sample and backend-test seeds; production deploys never run either seed.
- `config/` — source JSON for generated contracts, categories, limits, and retention.

## Verification and delivery

- `scripts/check-ui-primitives.mjs` — rejects retired Vue references, `transition-all`, arbitrary elevation, ungated hover, business imports in UI primitives, direct service imports in pages/components, route pages over 220 lines, and domain components over 300 lines.
- `scripts/check-i18n.mjs` — validates catalog parity/shape/interpolation, API error references, direct `t()` references, and hard-coded Han text across React/TSX sources.
- `scripts/run-local-verification.mjs` — local typecheck, lint, UI/i18n checks, unit/architecture tests, build, and build-budget orchestration.
- `scripts/database.mjs` — cross-platform PostgreSQL 17 container lifecycle, checksummed forward migrations, deterministic local seeding, and migration status. Remote operation is migration-only and requires an explicit `DATABASE_URL`.
- `scripts/migration-checksum.mjs` — canonical cross-platform migration hashing and immutable applied-migration validation for every current and future SQL migration.
- `scripts/configure-database-runtime.mjs` — creates or rotates the `novae_runtime` login, grants only DML, sequence use, and function execution, verifies those credentials with a real application-table query, and can hand the verified URL to deployment for immediate Hyperdrive synchronization; it grants no DDL or role-management capability.
- `scripts/configure-cloudinary.mjs` — idempotently provisions the authenticated image upload preset during deployment, with explicit provider errors instead of healthcheck side effects.
- `scripts/reset-cloudinary.mjs` — explicit destructive Cloudinary Admin API cleanup used only by the protected reset workflow.
- `scripts/verify-integration.mjs` — single Node.js orchestrator for PostgreSQL, Windows WSL runtime lifetime, least-privilege role setup, provider receivers, Wrangler, Firebase Auth Emulator, interactive Next.js, integration/stress tests, and Playwright. Backend-only runs use the integration seed; served/E2E runs use the local sample seed.
- `scripts/render-worker-config.mjs` — validates the Hyperdrive ID and renders relocatable environment-specific Worker/Queue names, entry paths, native rate-limit namespace IDs, and optional Notion state without committing deployment bindings.
- `scripts/external-provider-test-server.mjs` — isolated Cloudinary, FCM, and Notion-compatible receiver used only by integration verification.
- `scripts/generate-harmonyos-subset.mjs` / `check-build-budget.mjs` — derive the used Traditional Chinese HarmonyOS Sans shards from source text, then enforce Next build asset/font/JS/CSS budgets.
- `tests/unit/` — Vitest domain and design-system tests.
- `tests/architecture/` — route, data-access, generated contract, UI boundary, and delivery tooling tests.
- `tests/integration/` — backend actions, category-scoped authorization, least-privilege database boundary, RPCs, jobs, retention, and Worker ingress/realtime behavior; required for backend changes.
- `tests/e2e/` — Playwright bootstrap plus authenticated desktop/mobile workflows.
- `.github/workflows/verify-pr.yml` — Node 24 local, PostgreSQL/Worker integration, and real-browser verification.
- `.github/workflows/deploy-frontend.yml` — Vercel Next.js build/deploy using `NEXT_PUBLIC_*` runtime names mapped from existing secret storage names.
- `.github/workflows/deploy-backend.yml` — local backend verification, forward Neon migrations, runtime-role configuration, environment-specific Worker rendering, Queue provisioning, Cloudflare deployment, and authenticated/database smoke checks.
- `.github/workflows/backup-database.yml` — daily cadence check that creates a PostgreSQL 18 logical dump only when the newest backup is at least 72 hours old, encrypts it with age, verifies it with a checksum, and prunes GitHub artifacts to the latest two; plaintext never leaves the runner.
- `.github/workflows/reset-database-and-cloudinary.yml` — protected manual disaster-reset flow: after an exact confirmation string, resets the application schemas, reapplies migrations, restores the Worker runtime role, clears Cloudinary resources, and restores the upload preset.

## Design documentation

- `DESIGN.md` — current frontend visual language, component, responsive, and motion rules.
- `ui-design-system.md` — compatibility pointer to `DESIGN.md` and implementation constraints.
- `PRODUCT.md` — product purpose, users, features, and explicitly approved runtime migration.
- `AGENTS.md` — repository boundaries, safety rules, and required verification commands.
