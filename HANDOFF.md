# Handoff — refactor/overhaul (2026-10-14)

Working note. Delete it once P7 is done and the content has moved into commit messages or docs.

## Task and rules from the user

- Audit and refactor the frontend and backend thoroughly. Simplify, delete old code, and don't be conservative. The code was built incrementally by a weaker AI.
- Banned:
  - Results-oriented programming (making a check pass instead of fixing the behavior).
  - Wishful programming: silent fallbacks, swallowed errors. Fix root causes and fail loudly.
- Migrations may be squashed.
- Mode is **AUTO**:
  - Local commits per phase are authorized, and so are dependency installs.
  - **Never push.** A push deploys. Also no PRs, releases or other external actions.
- Verify only with typecheck, lint, unit, integration and Playwright E2E. **No manual browser or preview checks**, and no phone preview.
- Reply in Traditional Chinese only. Minimize subagents.
- Commit trailer:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_019Lp4F3kqCho4Wzb1o95DcT
  ```
- Before writing Next-specific code, read `node_modules/next/dist/docs/` (Next 16.3).
- The final report covers: what was done, test results, what was skipped or unverified, and the external actions not taken. Ask before pushing.

## Phases

| Phase | Status |
|---|---|
| P0 fix deploy verification, P1 dead code | committed |
| P2/P3 shared valibot contracts in `shared/`; every Worker answer conforms to its contract; retire unused writes | committed (`508cae03`..`3dbe3bb1`) |
| P4 replace hand-rolled caches with TanStack Query | committed (`93baa9ef` wip + follow-up) |
| P5 merge the session and request layers; invalidate the cache when access or role changes (the gap predates P4) | todo |
| P6 squash migrations into a baseline; clean stale DB overloads | todo |
| P7 docs; rebuild the project-map tool against ACTIONS and the registry; add `knip` as a devDependency and act on it | todo |

## P4 design

- Dependency: `@tanstack/react-query` 5.104.2 only. The persist packages were removed; persistence is our own code.
- `src/lib/query-client.ts` holds the single `queryClient`:
  - `gcTime` 24h. 30 days overflowed `setTimeout`, and GC fired at once.
  - `retry: false`.
  - `staleTime = viewMemoryMinutes * 60000`.
  - Refetch on focus and reconnect.
- Helpers in the same file:
  - `invalidate(key)` refetches active queries only while the tab is visible.
  - `invalidateLists(domain)` trims a list to its first page, then invalidates it.
  - `invalidateDomain`.
  - `seedQuery`.
  - `readQuery(key, read, maxAgeMs)`.
  - `patchEntity` and `dropEntity` walk the cache structurally.
- Persistence:
  - IndexedDB database `novae-queries`, store `clients`.
  - One record per uid: `{buster:'1', state: dehydrate()}`.
  - Saves are throttled to 1s, then flushed on `visibilitychange` (hidden) and `pagehide`.
  - Restore drops queries older than 30 days.
  - `meta:{persist:false}` keeps a query off disk.
  - `openQueryScope(uid)` / `closeQueryScope({forget})`. Logout or a user switch calls `forget`.
  - Retires the old IndexedDB databases `novae-content-cache-v4` and `v5`, and the localStorage key `novae:content-versions:${uid}`.
- Content versions live in the query cache under `['content-versions']`, so they persist atomically with the data. Keeping them in localStorage let stale data look fresh.
- Key factories:
  - `issueKeys`, `facilityKeys`, `announcementKeys`, `notificationKeys`.
  - `['session','bootstrap'|'access']`.
  - `['dashboard']`.
  - `['profiles',uid]`.
  - `['uploads',id]`.
  - `['push',...]`.
  - `['remembered',key]`.
- `src/hooks/use-paged-query.ts` is the generic `useInfiniteQuery` hook for feeds and comments. `loadMore` uses `cancelRefetch:false`.
- Deleted modules:
  - content-read-cache
  - persistent-cache
  - view-memory-cache
  - content-entity-store
  - use-content-entity
  - use-content-invalidation-refresh
  - use-paged-request-guard
  - use-cold-data-reveal
  - supported-issue-memory
  - route-request
  - refresh-scheduler
  - their tests
- Policy change: `viewMemoryEntries` was removed by migration `0066_retire_view_memory_entries.sql`, and from policies, presets and i18n.
- Unit test helper: `tests/unit/support/query-client.ts` (`withQueryClient`, synchronous `notifyManager`).
- E2E helper: `storedQueryKeys(page)` in `tests/e2e/support/accounts.ts`.

## Verification state (2026-10-15, after a machine reinstall)

- Environment rebuilt: `bun install`, docker.io, openjdk-21, Playwright Chromium and its system deps.
- `bun run verify:fast` passes.
- Full `bun run test:e2e`: 51 passed, 1 skipped (local-startup, by design), twice in a row.
- The earlier sign-in timeout (`__NOVAE_E2E__` never appearing) did not reproduce; the old trace was lost. Hardened instead of guessed:
  - `E2eAuthBridge` no longer swallows a failed import; `signInWithEmulator` reports page errors when the bridge never appears.
  - The `novae-queries` connection closes on `versionchange`, so another page's delete or upgrade cannot leave opens hanging; a failed open is not cached.
  - The comment-order spec only tolerates a failed `route.fulfill` when the page itself cancelled the read.

## Known follow-ups

- P5: a role or access change does not invalidate cached data. Decide on per-domain invalidation, or `closeQueryScope` without `forget`.
- `session-store.ts` still wires the bootstrap by hand (`cachedAccessPromise`, `displaySnapshotPromise`). This is a P5 merge candidate.
