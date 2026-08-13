# Novae frontend design language

## Direction

Novae keeps its existing information architecture and product flows, but presents them through a precise, neutral design language derived from the implementation principles in transitions.dev. It is a product interface, not a marketing landing page: calm surfaces, compact controls, strong hierarchy, and motion that makes state changes legible.

## Visual system

- Inter is the primary Latin UI face. HarmonyOS Sans TC is used for Traditional Chinese, with PingFang TC and Microsoft JhengHei as system fallbacks. Roboto Mono is reserved for identifiers and operational data.
- The palette is neutral and low-chroma. Light mode uses a near-white stage and white elevated surfaces; dark mode uses layered charcoal surfaces rather than pure black.
- Borders are thin and translucent. Depth comes from surface separation first, then the three constrained shadows: `--shadow-control`, `--shadow-card`, and `--shadow-floating`.
- Radius hierarchy is intentional: compact controls use the smaller radius, cards use the base radius, larger floating surfaces use the larger radius, and segmented/navigation controls are pills.
- Spacing is compact but never crowded. Page gutters belong to the app shell; route views only establish vertical rhythm and local grids.
- Product typography uses stable semantic roles across routes: 24px page titles, 24px mobile and 28px desktop detail titles, 16px/28px reading text, 16px card and section titles, 13px buttons, 13px metadata, and 11px segmented controls.
- Gradients, neon, glow, oversized shadows, and ambient glass effects are not part of the language.
- Every rendered Novae mark uses the shared square brand frame. The N preserves its original geometry with `object-contain`, generous internal clearance, and a frame large enough to remain legible in the sidebar, authentication, setup, and startup surfaces.

## Components

- shadcn/ui composition and Radix accessibility behavior remain the base for buttons, inputs, cards, dialogs, sheets, dropdowns, tabs, switches, selects, tooltips, alerts, and toasts.
- Primary actions use a dense, high-contrast treatment. Common buttons are 36px tall, compact buttons are 32px, and the visible control is not enlarged to a blanket 44px touch target. Secondary and ghost variants preserve geometry and focus affordances.
- Hover follows interaction semantics: controls and clickable rows change by one restrained surface or text step, directional icons may shift 1–2px, and non-interactive surfaces remain visually still.
- Cards use soft surface contrast, a hairline border, and restrained elevation. Only clickable cards receive hover feedback: a spatially stable 1% light-mode or 0.5% dark-mode surface tint, while directional icons may move independently.
- Inputs and composer surfaces use a shared control frame with explicit focus rings and no layout shift.
- Desktop dialogs become bottom-sheet presentations on small screens where appropriate, with safe-area padding and `100dvh` constraints.
- The liquid motion language is reserved for navigation, segmented state movement, and bounded identity moments. Tabs use a measurement-free shared-layout spring so their selected surface exists on the first frame. The `liquid-gooey` SVG silhouette is bounded to the login identity scene with reduced blur, filter padding, and content blur so it sleeps at idle; high-density feed items never instantiate per-row liquid or Motion runtimes.

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

- Proposal support and facility affected actions use a line-hand reaction that presses and rises with an upward particle fan; announcement likes retain the filled-heart pop and radial particle burst. Reaction controls keep their icon visible while the request is pending, prevent duplicate input, and play their own confirmation animation immediately after server success instead of inserting a generic spinner or check.
- Reaction counts animate per character without changing their inline width. Celebration particles are reserved for activating a reaction; removing one still receives the success check but no celebration.
- Route navigation commits directly without full-page snapshots or an outgoing layer. The newly committed route alone moves 24px from right to left over 350ms with a restrained 2px blur and no delay; local loading states appear through the same destination node. Feed results use CSS-only opacity/translate staggering only when filters, sort, category, or committed search terms change.
- Route changes never add a deliberate entrance delay: route bundles and RSC shells may warm in advance, but content services do not preload; the destination commits directly and owns its immediate loading feedback.
- Skeletons, spinners, toasts, and success marks use shared motion classes so async feedback has the same timing throughout the app.

## Responsive behavior

- Desktop shows the complete sidebar and full labels.
- Intermediate widths compact the shell and secondary chrome while preserving the same routes and data flow.
- Mobile uses an intentional top bar and bottom navigation with safe-area insets; it is not a scaled-down desktop sidebar.
- Mobile navigation retains generous touch regions, while in-content buttons and segmented controls prioritize the product's compact operating density instead of a blanket 44px minimum.
- Mobile primary navigation uses the established floating geometry: a 60px pill with 16px viewport insets, 12px/6px internal padding, a 15–25px safe bottom gap, and the current neutral surfaces, shadows, and active-state treatment.
- The mobile bottom navigation recedes on secondary routes: proposal/facility/announcement detail and composer pages, My Proposals, Dashboard, and administration. Its reserved content space disappears with it and returns only on primary list destinations.
- Select and dropdown surfaces stay content-sized on compact viewports, match the proposal-category menu behavior, and never exceed the viewport minus 16px on either side.
- Layouts use `100dvh`, safe-area tokens, and content-aware grids. Sticky controls account for mobile headers and desktop shells independently.
- Feed cards use one column on compact viewports and two equal-height columns on desktop, keeping actions aligned at each card footer.
- Hover treatments only exist inside `@media (hover: hover) and (pointer: fine)` to avoid sticky touch hover.
- The document disables double-tap zoom and scroll chaining while retaining pinch zoom, native single-finger scrolling, and independent overflow inside dialogs or menus. Top-edge blur appears only after the page has actually scrolled.

## Architecture rules

- `src/app` routes assemble views and do not import services.
- Domain presentation in `src/components` forwards events and does not import services.
- Stateful data and product flows live in `src/hooks`; service/API boundaries live in `src/services`.
- `src/components/ui` never imports session state, hooks, or services.
- Route pages are capped at 220 lines and domain presentation components at 300 lines by `check:ui`.
- New patterns must extend semantic tokens or shared primitives instead of adding page-local hard-coded systems.
