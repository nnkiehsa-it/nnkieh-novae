# Novae frontend design language

## Direction

Novae keeps its existing information architecture and product flows, but presents them through a precise, neutral design language derived from the implementation principles in transitions.dev. It is a product interface, not a marketing landing page: calm surfaces, compact controls, strong hierarchy, and motion that makes state changes legible.

## Visual system

- Inter is the primary Latin UI face. HarmonyOS Sans TC is used for Traditional Chinese, with PingFang TC and Microsoft JhengHei as system fallbacks. Roboto Mono is reserved for identifiers and operational data.
- The palette is neutral and low-chroma. Light mode uses a near-white stage and white elevated surfaces; dark mode uses layered charcoal surfaces rather than pure black.
- Borders are thin and translucent. Depth comes from surface separation first, then the three constrained shadows: `--shadow-control`, `--shadow-card`, and `--shadow-floating`.
- Radius hierarchy is intentional: compact controls use the smaller radius, cards use the base radius, larger floating surfaces use the larger radius, and segmented/navigation controls are pills.
- Spacing is compact but never crowded. Page gutters belong to the app shell; route views only establish vertical rhythm and local grids.
- Product typography uses stable semantic roles across routes: 24px page titles, 24px mobile and 28px desktop detail titles, 16px/28px reading text, 16px card and section titles, 12px control labels, and 13px metadata. Buttons, selects, menus, tabs, and segmented labels receive the 12px value from the single `[data-control-label=""]` rule; primitives do not restate it in utility classes, preventing a larger first frame from being overridden after mount. Selects serving as page titles are explicitly marked as headings and retain the page-title role from the first render.
- Gradients, neon, glow, oversized shadows, and ambient glass effects are not part of the language.
- Every rendered Novae mark uses the shared square brand frame. The N preserves its original geometry with `object-contain`, generous internal clearance, and a frame large enough to remain legible in the sidebar, authentication, setup, and startup surfaces.

## Components

- shadcn/ui composition and Radix accessibility behavior remain the base for buttons, inputs, cards, dialogs, sheets, dropdowns, tabs, switches, selects, tooltips, alerts, and toasts.
- Primary actions use a dense, high-contrast treatment. Common buttons are 36px tall, compact buttons are 32px, and the visible control is not enlarged to a blanket 44px touch target. Secondary and ghost variants preserve geometry and focus affordances.
- Hover follows interaction semantics: controls and clickable rows change by one restrained surface or text step, directional icons may shift 1–2px, and non-interactive surfaces remain visually still.
- Cards use soft surface contrast, a hairline border, and restrained elevation. Only clickable cards receive hover feedback: a spatially stable 1% light-mode or 0.5% dark-mode surface tint, while directional icons may move independently.
- Inputs and composer surfaces use a shared control frame with explicit focus rings and no layout shift.
- Discussion uses one continuous card surface with hairline-separated root comments and a single rail for nested replies. The avatar-led composer floats at the safe-area bottom as one large-radius bordered surface—its input row does not add nested frames, its avatar and circular up-arrow action share a bottom edge, and growing text expands upward. Replying adds a two-line target preview above it with the author, a 20-character excerpt, and an explicit cancel action. Reply groups start collapsed and expose an explicit count; root order is user-selectable while replies remain chronological.
- Dialog and alert-dialog positioning is owned by a full-viewport grid positioner, so motion never overrides centering on desktop or mobile. Safe-area padding and `100dvh` constraints keep long content reachable.
- The liquid motion language is reserved for navigation, segmented state movement, and bounded identity moments. Tabs use a measurement-free shared-layout spring so their selected surface exists on the first frame. Gooey-style motion is expressed through small transform/opacity layers rather than a full-screen SVG filter; high-density feed items never instantiate per-row filter or Motion runtimes.

## Motion

Motion uses opacity, blur, and transform in named recipes instead of `transition-all`.

- Micro feedback: 80ms.
- Quick control state: 150ms.
- Fast entrances and exits: 250ms.
- Layered panel motion: 350ms.
- Slow/emphasis moments: 400–500ms.
- Main entrance easing: `cubic-bezier(.22, 1, .36, 1)`.
- Exits are quicker than entrances; stronger exponential deceleration is reserved for bounded feedback such as count/like confirmation.

Routes, cards, text, numbers, dialogs, dropdowns, tabs, menus, toasts, loading skeletons, and success feedback all use state-specific recipes. Motion must communicate what changed, not run continuously for decoration. `prefers-reduced-motion` removes nonessential transform/blur movement while preserving state clarity.

- Proposal support and facility affected actions use a line-hand reaction that presses and rises with an upward particle fan; announcement likes retain the filled-heart pop and radial particle burst. Every reaction control uses the same state hierarchy: inactive is a quiet secondary/ghost surface, active is the high-contrast primary surface, and its icon occupies a fixed 16px geometry box so icon-only and icon-plus-count variants share one optical center. Detail reaction actions are centered consistently. Reaction controls keep their domain icon visible while the request is pending, prevent duplicate input, and use their own particles as the success response without an extra spinner, check, or toast.
- Reaction counts animate per character without changing their inline width. Celebration particles are reserved for activating a reaction; removing one still receives the success check but no celebration.
- On both desktop and mobile, primary destinations selected from the sidebar or bottom navigation replace the prior route before the entire committed `.route-page` fades in over 350ms, with no translation, blur, document snapshot, or text-only transition. Child routes always enter 24px from the right and travel left into place; explicit and browser-history returns always enter 24px from the left and travel right into place. A stamped in-app history index distinguishes browser back from browser forward, so history traversal never guesses the direction from `popstate` alone. Spatial child/return routes retain restrained blur while dense feeds remain fully painted instead of replaying viewport-entry motion.
- Forced updates and backend mutations use the shared spinner-to-check morph, holding the completed state for 500ms before navigation or dismissal. Destructive actions that immediately leave their source page also emit one persistent-route success toast so the outcome remains visible after navigation.
- Device push enable/disable and notification preference writes replace only the operated switch with that spinner-to-check morph; successful writes do not also emit a toast.
- Route changes never add a deliberate entrance delay: route bundles and RSC shells may warm in advance, but content services do not preload; the destination commits directly and owns its immediate loading feedback.
- Static primary route shells for announcements, notifications, and settings warm as soon as the authenticated app shell mounts, without waiting for session-category hydration; category-dependent routes join as soon as their destinations are known, and focus/hover intent refreshes the selected destination prefetch.
- Notification and settings routes provide explicit loading boundaries, so their prefetched headers and stable card geometry can commit before route-specific client code or backend reads complete.
- Back actions restore the preceding in-app list through browser history when it is the expected domain, preserving its React/router memory, filters, category label, scroll position, and prefetched segment; direct detail entries still fall back to the canonical list route. Client route segments remain warm for five minutes when dynamic and thirty minutes when fully prefetched.
- History restoration is visually atomic: cached routes return at their preserved scroll and layout position without replaying the route entrance. Only a fallback navigation to a non-cached parent uses the mobile reverse-direction transition.
- Dashboard and system administration are privileged secondary routes. Once the authenticated permission snapshot is known, their route shells and both administration tab URLs prefetch immediately rather than waiting for category hydration or idle time. Both use the same compact back toolbar and loading-shell geometry as other secondary mobile routes.
- Primary proposal, facility, announcement, notification, dashboard, and push-settings views also retain bounded user-scoped LRU snapshots for 30 minutes. A remount paints the prior records, pagination cursor, category, sort, search, status controls, and device preferences immediately while the existing service cache/realtime invalidation path refreshes authority in the background; matching mutation/realtime invalidations evict dependent snapshots before they can repaint stale records, and logout clears every snapshot for that user.
- Skeletons, spinners, progress tracks, toasts, and success marks use shared motion classes so async feedback has the same timing throughout the app. Toasts use transitions.dev's 350/250ms rise, 16px offset, 2px cross-blur, 0.97 scale, and 52px pill surface. Startup and forced-update stages reuse the Novae brand lockup and bounded progress motion without delaying navigation.
- Dense feeds stay fully laid out and painted ahead of the viewport. Cards and articles do not use `content-visibility:auto`, intrinsic-size substitution, or viewport-driven opacity states; fast scrolling therefore never waits for a near-viewport observer callback. Resolved content images start eager low-priority decoding as soon as their detail surface renders.
- Route displacement retains the full 350ms spatial motion, while its whole-page blur resolves in the first 150ms so a fast skeleton handoff cannot keep newly arrived cards inside an expensive filter layer. Detail handoff blur is applied to Markdown text only, never the card, media rail, padding, border, or shadow.
- Every cold route or local loading boundary hands off through the shared `SkeletonReveal` recipe: the final field owns layout while its lighter skeleton is absolutely stacked in the same slot. Only the exact text or numeric field sharpens from a bounded 2px blur over 400ms; there is no handoff translation. The reveal flag retires after that first handoff, so later state changes cannot replay it. A cold skeleton remains visible for at least 280ms so a fast response cannot produce a one-frame flash. Fields restored from authoritative view/detail memory bypass the skeleton and reveal animation entirely. Author rows synchronously read the existing profile memory cache; a genuinely unresolved author reserves a 24px avatar and 64px mixed-script name skeleton instead of rendering a generic member label.
- Category and status tags use the shared centered badge-label reveal, so cold skeleton width cannot change text alignment after cache restoration. Detail skeletons reserve title and two content lines but no speculative media height; real media allocates space only when the fetched content actually contains it. Proposal categories that do not expose comments skip comment fetching and omit the complete discussion surface rather than rendering a disabled placeholder.
- Every shared card carries the low-cost transitions.dev CSS resize recipe for explicit size changes. Cards that genuinely change intrinsic height in place—discussion, category setup/editing, and scoped-access results—use the opt-in `ResizableCard` Motion layout projection with the same 300ms `cubic-bezier(.22, 1, .36, 1)` timing. Fixed dense feed and skeleton cards remain server-rendered plain cards, avoiding per-row Motion hydration. Reduced-motion disables both paths.
- List entities are summary-grade cache entries even when a transport happens to include content text. They may update shared title/status/reaction fields, but cannot satisfy a detail read or overwrite authoritative detail-only fields. A cold content route always reserves the full detail geometry and fetches the detail endpoint; only a previously fetched authoritative detail can render immediately without skeletons.

## Responsive behavior

- Desktop shows the complete sidebar and full labels.
- Intermediate widths compact the shell and secondary chrome while preserving the same routes and data flow.
- Mobile uses an intentional top bar and bottom navigation with safe-area insets; it is not a scaled-down desktop sidebar.
- iOS uses `viewport-fit=cover` with a translucent standalone status bar. The root document, pre-i18n fallback, AppStart surface, manifest, and theme-color metadata share the same stage background, dynamic viewport height, and safe-area padding so startup cannot briefly change its visible region.
- Mobile navigation retains generous touch regions, while in-content buttons and segmented controls prioritize the product's compact operating density instead of a blanket 44px minimum.
- Mobile primary navigation uses the established floating geometry: a 60px pill with 16px viewport insets, 12px/6px internal padding, a 15–25px safe bottom gap, and the current neutral surfaces, shadows, and active-state treatment.
- Mobile primary-navigation labels are single-line, width-constrained, and ellipsized so long translations never overlap adjacent destinations. Primary routes reserve an additional 1.4rem above the floating bar for final-page actions.
- The mobile bottom navigation recedes on secondary routes: proposal/facility/announcement detail and composer pages, My Proposals, Dashboard, and administration. Its reserved content space disappears with it and returns only on primary list destinations.
- Select and dropdown surfaces stay content-sized on compact viewports, match the proposal-category menu behavior, and never exceed the viewport minus 16px on either side.
- Layouts use `100dvh`, safe-area tokens, and content-aware grids. Sticky controls account for mobile headers and desktop shells independently.
- Feed cards use one column on compact viewports and two equal-height columns on desktop, keeping actions aligned at each card footer.
- Hover treatments only exist inside `@media (hover: hover) and (pointer: fine)` to avoid sticky touch hover.
- Tooltips are a fine-pointer enhancement only. Coarse-pointer and non-hover devices never open tooltip layers; mobile actions remain understandable through their accessible labels and native placement.
- The document disables double-tap zoom and scroll chaining while retaining pinch zoom, native single-finger scrolling, and independent overflow inside dialogs or menus. Top-edge blur appears only after the page has actually scrolled.

## Architecture rules

- `src/app` routes assemble views and do not import services.
- Domain presentation in `src/components` forwards events and does not import services.
- Stateful data and product flows live in `src/hooks`; service/API boundaries live in `src/services`.
- `src/components/ui` never imports session state, hooks, or services.
- Route pages are capped at 220 lines and domain presentation components at 300 lines by `check:ui`.
- New patterns must extend semantic tokens or shared primitives instead of adding page-local hard-coded systems.
