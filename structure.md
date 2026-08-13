# Novae repository structure

This document is the maintained map of the repository. Read it before broad searches and update it whenever files or responsibilities move.

## Runtime and entry points

- `package.json` — Node 24, Next.js 16.3, React 19.2, TypeScript 7, Tailwind CSS 4, Radix/shadcn primitives, Motion, liquid-gooey, Serwist, Vitest, and Playwright scripts.
- `src/app/` — Next App Router. Route `page.tsx` files assemble views and forward events; they do not import `services/` directly.
- `src/app/layout.tsx` — root metadata, Inter/Roboto Mono plus HarmonyOS Sans TC split-font loading, global providers, and global CSS.
- `src/app/globals.css` — semantic light/dark color, typography, radius, shadow, safe-area, viewport, and surface tokens.
- `src/assets/fonts/harmonyos-sans-tc/` — generated, project-character-scoped HarmonyOS Sans TC Regular shards and CSS; refreshed by `scripts/generate-harmonyos-subset.mjs`.
- `src/styles/motion.css` — transition.dev-inspired timings/easing and named recipes for routes, panels, cards, text, digits, dialogs, dropdowns, toasts, loading, and success states. Includes hover-capability and reduced-motion media queries.
- `src/app/sw.ts` — Serwist service worker; `next.config.mjs` compiles and registers it at `public/sw.js`.
- `src/proxy.ts` — per-request nonce CSP for Next hydration, strict production script execution, and local-emulator development connections.
- `next.config.mjs` — public environment injection, static security headers, image hosts, and Serwist integration.
- `components.json` — shadcn/ui aliases and Tailwind 4 configuration.
- `vercel.json` — Vercel Next.js framework configuration.

## App Router

- `src/app/login/` — Google sign-in presentation and animated product overview.
- `src/app/(protected)/layout.tsx` — authenticated application guard and shared shell boundary.
- `src/app/(protected)/setup/` — two-stage language and category setup; idempotent completion recovery lives in `use-initial-setup`.
- `src/app/(protected)/issues/` — feature-guarded issue redirect, feed, composer, and detail routes.
- `src/app/(protected)/facilities/` — feature-guarded facility feed, composer, and detail routes.
- `src/app/(protected)/announcements/` — announcement feed, composer, and detail routes.
- `src/app/(protected)/notifications/` — merged broadcast/admin/user notification presentation.
- `src/app/(protected)/settings/` — account, appearance, language, install, push, and resource settings.
- `src/app/(protected)/dashboard/` — animated platform statistics and operational diagnostics.
- `src/app/(protected)/admin/` — unified category/feature and scoped member-access management.

## Presentation components

- `src/components/ui/` — business-free shadcn/Radix primitives. Buttons, fields, cards, overlays, tabs, sheets, menus, status badges, skeletons, page states, and the shared Novae brand lockup share global semantic tokens.
- `src/components/motion/` — reusable motion wrappers: animated numbers/text, like feedback, staggered lists, and transition helpers.
- `src/components/app-shell.tsx` / `liquid-nav.tsx` — desktop, compact desktop, and mobile navigation. liquid-gooey is constrained to intentional navigation/tab state changes.
- `src/components/issues/` — issue cards, detail content/actions, and moderation presentation.
- `src/components/facilities/` — facility cards and status-dialog presentation.
- `src/components/announcements/` — announcement cards.
- `src/components/settings/` — account, appearance/install, push preferences, and resource cards.
- `src/components/setup/` — setup step chrome and reusable category draft editors.
- `src/components/admin/` — category, reusable category-editor controls, and scoped-access presentation.
- `src/components/composer-fields.tsx` — shared title/Markdown/media composer surface.
- `src/components/discussion.tsx` — shared threaded discussion presentation.
- `src/components/content-author.tsx` — shared author avatar and name row for list content.
- `src/components/content-renderer.tsx` — sanitized Markdown/media rendering.
- `src/components/protected-app.tsx`, `app-providers.tsx`, `app-update-gate.tsx` — startup/session, providers, theme/i18n, toast boundaries, and bounded forced PWA updates with version polling, service-worker takeover, and reload recovery.
- `src/components/feature-route-guard.tsx` — shared disabled-feature guard for direct proposal and facility routes.

## Hooks and stateful flows

- `src/hooks/use-session.tsx` — Firebase authentication, role/permission snapshot, setup status, and supported-issue session state.
- `src/hooks/use-categories.ts` — category and platform-feature store.
- `src/hooks/use-issue-feed.ts`, `use-issue-detail.ts` — issue list/detail fetching, pagination, comments, support, and delete flows.
- `src/hooks/use-facility-feed.ts`, `use-facility-detail.ts`, `use-facility-status.ts` — facility list/detail, affected-user, delete, and moderation flows.
- `src/hooks/use-announcement-feed.ts`, `use-announcement-detail.ts` — announcement list/detail, likes, comments, and deletion.
- `src/hooks/use-notifications-page.ts`, `use-notification-badge.ts` — notification aggregation, realtime subscriptions, pagination, target routing, and unread hints.
- `src/hooks/use-route-preload.ts` — authenticated route bundle and RSC-shell warming only; primary navigation preloads immediately and secondary routes during idle time without mounting data hooks or requesting content services.
- `src/hooks/use-entry-composer.ts` — issue/facility/announcement composer workflows and upload rollback.
- `src/hooks/use-initial-setup.ts` — setup validation, persistence, polling, and retry-safe completion.
- `src/hooks/use-category-management.ts`, `use-access-management.ts` — platform configuration and category-scoped RBAC flows.
- `src/hooks/use-platform-dashboard.ts` — dashboard fetching and refresh.
- `src/hooks/use-permission-redirect.ts` — shared client-side redirect for authenticated routes that require a specific permission.
- `src/hooks/use-push-notifications.ts`, `use-pwa-install.ts` — device push preferences and install flow.
- `src/hooks/use-image-attachments.ts`, `use-resolved-markdown.ts`, `use-public-profiles.ts` — reusable media, Markdown, and public-profile helpers.

## Data, domain, and infrastructure

- `src/services/` — frontend boundary for Cloudflare gateway, Supabase reads/realtime, uploads, session roles, and backend actions. Only hooks and other services import it.
- `src/lib/` — framework-independent request, Firebase, Supabase, caching, Markdown, image, route, formatting, and domain utilities.
- `src/constants/` — generated/static application, category, status, retention, API error, and rate-limit constants.
- `src/types/` — shared frontend/domain types.
- `src/i18n/` — reactive React i18n store and paired `en` / `zh-TW` domain catalogs. `ui.ts` contains the rebuilt interface language.
- `src/generated/` — generated frontend contracts; do not edit manually.
- `cloudflare/` — API gateway worker and generated action policies.
- `supabase/functions/` — Edge Functions and shared backend code; unchanged by the frontend redesign.
- `supabase/migrations/` — immutable deployed migrations plus append-only new migrations.
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
