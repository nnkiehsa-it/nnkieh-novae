# Product interface design

## Direction

Taste-guided visual overhaul for a daily-use campus application, using the current `novae-website` brand. DESIGN_VARIANCE 4, MOTION_INTENSITY 4, VISUAL_DENSITY 7. Marketing layouts are confined to the desktop login surface. Product routes retain their existing information architecture, fields, permissions, and workflow.

## Continuity revision

- LiquidTabs use a soft neutral rail for inactive options and a restrained brand fill only on the selected pill. Custom color selection and persistence are removed.
- Feed titles use 18px type and a 28px line height.
- `FeedList` retains physical card frames across pending, populated, empty, and error states. `DetailLayout` does the same for the content and sidebar cards.
- Notifications, dashboard metrics, category settings, and administrative lists retain their surfaces while fields resolve. Pending platform settings render disabled real fields instead of a blank page.
- Explicit state containers opt into a shared 180ms height-only resize transition. Their loading, empty, error, and resolved children crossfade in and out without replacing the physical card; dynamic lists animate item entry and exit. Viewport reflow never becomes a size animation, grid content aligns to the start to avoid feedback loops, and reduced motion disables movement.
- Route surfaces no longer remount by pathname, and state containers no longer remount by loading identity. Route prefetch and preload remain intact.
- Warm-navigation browser checks confirmed retained feed nodes and a single settled empty-card resize; the fast verification suite passed. No full-suite rerun is claimed for this revision.

## Visual system

- Light: stage `#f5f7fb`, card `#fdfefe`, inset `#edf2f8`, text `#101828`, muted text `#566477`, brand `#1557d5`.
- Dark: stage `#0d121b`, card `#131b27`, inset `#1a2534`, text `#edf3fb`, muted text `#9cabbf`, brand `#5d8ff0`.
- Blue is the fixed brand accent, expressed through semantic tokens. Dark blue actions use dark ink for readable contrast. Status colors retain their operational meaning.
- HarmonyOS Sans TC leads the existing self-hosted font stack. Page headings are 24px, detail headings 24-26px, feed titles 15px, ordinary controls 13px, metadata 12px. Editable mobile text stays at 16px.
- Base radius 12px, cards 16px, compact inset regions 10.5px; round avatars and the mobile navigation dock retain their functional shapes.
- Primary actions use the card surface with a defined border, while accent remains reserved for brand emphasis, selected states, and links. Cancel/secondary actions remain neutral. Elevation is centralized in three subtle shadow tokens.

## Density and reuse

- Feed cards use 16px padding and 12px gaps, with a compact title, 24px metadata slot, and at least 40px footer including its separator spacing.
- Lists retain a regular two-column desktop grid and single-column mobile grid. No decorative hero or extra summary tiles precede the data.
- Search and sorting occupy one 40px row. The same `FeedToolbar` renders during loading.
- `FeedCard` owns all three domains' frame and link geometry. Domain components only supply metadata, progress, status, and callbacks.
- `DetailCardHeader` and `DetailCardBody` own live and pending detail geometry. Shared primitives propagate the brand to settings and administrative surfaces without reducing their operational density.

## App-like loading and motion

- Route placeholders paint the real shell and real disabled controls before data arrives.
- Feed and detail placeholders use the same components as loaded content. Only unknown fields become skeletons.
- Category support capability determines whether a proposal feed placeholder reserves a progress region. Mixed-category personal feeds cannot know every row's shape before the data arrives.
- Optional support deadlines share the progress label row, so they do not add a vertical jump.
- Titles and author metadata retain minimum heights. Unknown long content and wrapped detail titles can still increase height once fetched; no fake fixed-height document is imposed.
- Existing route prefetching, session-scoped feed memory, optimistic reactions, stable navigation, retained card frames, and state-height resizing remain in use.
- Reduced motion removes displacement and transition delays. Avoid new perpetual effects, scroll reveals, or per-row viewport observers in feeds.

## Acceptance

- Inspect desktop/mobile in both themes and check overflow, title wrapping, visible controls, and custom accent contrast.
- Delay a feed response and compare the first skeleton's card/header/footer bounds with the corresponding loaded card.
- Confirm search, sort, navigation, creation, reactions, detail actions, and settings still work through existing browser workflows.
- Run `bun run verify:all` before final delivery; report any external verification blockers explicitly.
