# Handoff — refactor/overhaul (2026-10-14)

Untracked working note. Delete it once P4 is committed and the content has moved into the commit message or docs.

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
| **P4 replace hand-rolled caches with TanStack Query** | **done but uncommitted; one E2E fails** |
| P5 merge the session and request layers; invalidate the cache when access or role changes (the gap predates P4) | todo |
| P6 squash migrations into a baseline; clean stale DB overloads | todo |
| P7 docs; rebuild the project-map tool against ACTIONS and the registry; add `knip` as a devDependency and act on it | todo |

## P4 design (uncommitted; see `git status`)

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

## Verification state

- `bun run verify:fast` passes.
- Unit tests pass.
- `bun run verify:integration` passes, including migration 0066 and the DB contract drift check.
- E2E: the last full run had 46 passed, 1 failed, 1 skipped.

## Open issue (next step)

`tests/e2e/feed-and-discussion-state.spec.ts:65`, "a late comment order response cannot replace the currently selected order":

- It does **not** fail on the ordering logic.
- It times out in `signInWithEmulator`:
  - `tests/e2e/support/accounts.ts:67`, `waitForFunction(() => window.__NOVAE_E2E__)` after `page.goto('/login')`. Times out after 20s.
  - The call site is spec line 54.
- Inspect the trace: `test-results/e2e/feed-and-discussion-state--6644b-he-currently-selected-order-chromium-stateful/trace.zip`.
- Find out why the login page never exposes `__NOVAE_E2E__`. Candidates:
  - state left over from the previous test;
  - a blocked or failing `openQueryScope` or IndexedDB open, for example a `versionchange` against the deleted `novae-queries` database that the spec deletes;
  - a changed init order.
- Before this was found, the spec was already edited:
  - the route handler wraps `route.fulfill` in a `catch`;
  - an `oldestSettled` promise waits on `requestfinished` / `requestfailed`.
  - Re-check that these edits are still justified.

Rerun just the relevant specs:
```
node scripts/verify-integration.mjs --e2e -- tests/e2e/feed-and-discussion-state.spec.ts tests/e2e/session-lifecycle.spec.ts
```
Then run the full `bun run test:e2e` and `bun run verify:fast`, and commit P4.

## Known follow-ups

- P5: a role or access change does not invalidate cached data. Decide on per-domain invalidation, or `closeQueryScope` without `forget`.
- `session-store.ts` still wires the bootstrap by hand (`cachedAccessPromise`, `displaySnapshotPromise`). This is a P5 merge candidate.
