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
- `src/components/motion/` — reusable animated numbers, reaction feedback, and geometry-only feed wrappers. Dense list items stay mounted and painted without viewport observers or offscreen opacity states.
- `src/components/app-shell.tsx` / `liquid-nav.tsx` — desktop, compact desktop, and mobile navigation. Primary navigation updates immediately while the pathname-keyed incoming route node fades in only after the prior node has unmounted; no document View Transition snapshot can overlap content or cover the fixed sidebar/mobile dock. Child/back routes retain the shared depth-aware entrance motion, while selected navigation and tab surfaces use measurement-free shared-layout motion.
- `src/lib/navigation-memory.ts` — remembers the immediately preceding in-app pathname and hands one immutable root/child/back direction to each newly mounted route node, including browser-history and fallback returns.
- `src/components/issues/` — issue cards, detail content/actions, and moderation presentation.
- `src/components/facilities/` — facility cards and status-dialog presentation.
- `src/components/announcements/` — announcement cards.
- `src/components/settings/` — account, appearance/install, push preferences, and resource cards.
- `src/components/notifications/notification-skeleton.tsx` — route and local notification loading rows that share the resolved list container, padding, icon column, and text anchors.
- `src/components/dashboard/dashboard-skeleton.tsx` — geometry-matched dashboard toolbar, header, metric grid, distribution/operations columns, and failure-panel loading shell.
- `src/components/admin/administration-skeleton.tsx` — permission-matched system-management toolbar, tabs, and editor-frame loading shell used by route prefetch.
- `src/components/setup/` — setup step chrome and reusable category draft editors.
- `src/components/admin/` — category, reusable category-editor controls, and scoped-access presentation. The management surface follows a spacious choose-scope → edit → save hierarchy, uses divider-based category rows instead of nested cards, and adapts member assignment into two columns only at wide widths.
- `src/components/composer-fields.tsx` — shared title/Markdown/media composer surface.
- `src/components/discussion.tsx`, `comments/comment-composer.tsx`, `comments/comment-thread.tsx` — shared server-sorted discussion card, fixed safe-area avatar composer, reply-target preview, and collapsible reply-rail presentation.
- `src/components/content-author.tsx` — shared author avatar and name row for list content.
- `src/components/content-renderer.tsx` — sanitized Markdown/media rendering; its optional field-level reveal affects Markdown text only and leaves media/card chrome outside the filter layer.
- `src/components/detail-toolbar.tsx` — shared, geometry-stable secondary toolbar; detail routes add share/actions while Dashboard and system management reuse the same back geometry on mobile and desktop.
- `src/components/protected-app.tsx`, `app-providers.tsx`, `app-update-gate.tsx` — startup/session, providers, theme/i18n, transitions.dev-matched pill toast boundaries, and bounded forced PWA updates with version polling, service-worker takeover, animated progress, and reload recovery.
- `src/components/feature-route-guard.tsx` — shared disabled-feature guard for direct proposal and facility routes.
- `src/components/ui/route-skeleton.tsx` and route `loading.tsx` files — prefetched list/detail app-shell fallbacks that reuse the same header/grid/control geometry as their resolved routes while skeletonizing only unresolved domain fields; detail fallbacks reserve full title and two-line content geometry without treating list excerpts as detail cache, and no domain requests are started by the fallback.
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
- `src/hooks/use-image-attachments.ts`, `use-resolved-markdown.ts`, `use-public-profiles.ts` — reusable media, Markdown, and public-profile helpers.
- `src/hooks/use-content-invalidation-refresh.ts`, `use-action-feedback.ts` — shared stale-cache refresh wiring and 500 ms successful-action feedback lifecycle.

## Data, domain, and infrastructure

- `src/services/` — frontend boundary for Cloudflare gateway, Supabase reads/realtime, uploads, session roles, and backend actions. Only hooks and other services import it.
- `src/lib/` — framework-independent request, Firebase, Supabase, caching, Markdown, image, route, formatting, pagination, and domain utilities.
- `src/hooks/use-paged-request-guard.ts` — shared feed request generation/in-flight guard that prevents duplicate loads and stale query responses from committing.
- `src/lib/content-entity-store.ts` and `src/hooks/use-content-entity.ts` — normalized user-scoped content entities shared by lists, details, mutations, and realtime; summary/detail completeness prevents list excerpts from satisfying or overwriting authoritative detail reads, while field revisions prevent older requests from replacing newer local or realtime patches.
- `src/lib/view-memory-cache.ts` — bounded 30-minute, user-scoped LRU snapshots for primary list/query UI, pagination and dashboard state; hooks repaint cached views synchronously, refresh through existing services, and clear snapshots with the active session.
- `src/lib/loading-timing.ts` — shared cold-skeleton minimum duration; cached views bypass it while genuinely unresolved backend reads avoid one-frame loading flashes.
- `src/constants/` — generated/static application, category, status, retention, API error, and rate-limit constants.
- `src/types/` — shared frontend/domain types.
- `src/i18n/` — reactive React i18n store and paired `en` / `zh-TW` domain catalogs. `ui.ts` contains the rebuilt interface language.
- `src/generated/` — generated frontend contracts; do not edit manually.
- `cloudflare/` — API gateway worker and generated action policies.
- `supabase/functions/` — Edge Functions and shared backend code; unchanged by the frontend redesign.
- `supabase/migrations/` — immutable deployed migrations plus append-only new migrations.
  - `202608130001_comment_sorting.sql` adds cursor-safe newest/oldest root-comment ordering while preserving chronological replies.
- `config/` — source JSON for generated contracts, categories, limits, and retention.

## Verification and delivery

- `scripts/check-ui-primitives.mjs` — rejects retired Vue references, `transition-all`, arbitrary elevation, ungated hover, business imports in UI primitives, direct service imports in pages/components, route pages over 220 lines, and domain components over 300 lines.
- `scripts/check-i18n.mjs` — validates catalog parity/shape/interpolation, API error references, direct `t()` references, and hard-coded Han text across React/TSX sources.
- `scripts/run-local-verification.mjs` — local typecheck, lint, UI/i18n checks, unit/architecture tests, build, and build-budget orchestration.
- `scripts/verify-integration-local.mjs` / `.sh` — Windows-to-WSL or native Linux Supabase, Firebase Auth emulator, Cloudflare gateway, interactive Next.js dev server, production E2E server, integration, stress, and Playwright orchestration on port 3000. Backend-only integration resets omit development seed data; served and E2E environments load it.
- `scripts/find-windows-next-root.ps1` — resolves the workspace-owned Windows `npm run dev` root so WSL verification cleanup terminates the full Next.js process tree.
- `supabase/seed.sql` — deterministic local categories, setup state, profiles, roles, and sample content for emulator-backed development; never used by production migrations.
- `scripts/generate-harmonyos-subset.mjs` / `check-build-budget.mjs` — derive the used Traditional Chinese HarmonyOS Sans shards from source text, then enforce Next build asset/font/JS/CSS budgets.
- `tests/unit/` — Vitest domain and design-system tests.
- `tests/architecture/` — route, data-access, generated contract, UI boundary, and delivery tooling tests.
- `tests/integration/` — backend action/RLS/RPC behavior; required for backend changes.
- `tests/e2e/` — Playwright bootstrap plus authenticated desktop/mobile workflows.
- `.github/workflows/verify-pr.yml` — Node 24 verification.
- `.github/workflows/deploy-frontend.yml` — Vercel Next.js build/deploy using `NEXT_PUBLIC_*` runtime names mapped from existing secret storage names.
- `.github/workflows/deploy-backend.yml` — backend deployment; not part of frontend restyling.

## Design documentation

- `DESIGN.md` — current frontend visual language, component, responsive, and motion rules.
- `ui-design-system.md` — compatibility pointer to `DESIGN.md` and implementation constraints.
- `PRODUCT.md` — product purpose, users, features, and explicitly approved runtime migration.
- `AGENTS.md` — repository boundaries, safety rules, and required verification commands.
