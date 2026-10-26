# Novae design system

One dark theme. A deep navy canvas that lightens toward the bottom of the
screen, translucent glass panels floating on it, and a single emphatic fill —
a white pill with near-black type — for the current destination and the
primary action.

## Sources

| File | Owns |
| --- | --- |
| [src/ui/theme.css](src/ui/theme.css) | Every colour, radius, elevation and safe-area token, the canvas gradient, the `glass` material |
| [src/ui](src/ui) | The primitives. Feature code composes these and never restates their styling |
| [src/generated/motion-ladder.css](src/generated/motion-ladder.css), [src/lib/motion-timing.ts](src/lib/motion-timing.ts) | Durations and curves, from `config/motion.config.json` |
| [src/features](src/features) | Screens and domain components, composed from `src/ui`; see `structure.md` for the map |

`/ui-preview` renders every primitive in development.

## Tokens

| Tailwind name | Use |
| --- | --- |
| `canvas` | The page behind everything; painted as `--canvas-gradient` by a fixed layer |
| `surface` | Glass panels (`.glass` adds the blur) |
| `surface-raised` / `surface-pressed` | Tiles, fields and hover/press states inside a panel |
| `surface-solid` | Opaque layers over the page: sheets, menus, popovers |
| `ink` / `ink-muted` / `ink-faint` | Primary text, secondary text and values, placeholders and chevrons |
| `line` | Hairlines between rows and around fields |
| `contrast` / `on-contrast` | The white pill and the type on it |
| `positive` `caution` `danger` `info` | Status only: chips, errors, destructive actions |

Radii: `rounded-chip` (tags), `rounded-tile` (fields, nested tiles),
`rounded-panel` (panels, sheets), `rounded-icon` (the brand mark where it
stands as the app icon: sign-in and startup), `rounded-full` (buttons, navigation, segmented
controls). Elevation: `shadow-panel`, `shadow-float`.

## Primitives

- **Panel / Tile / SectionTitle** — content groups. A panel is the only card.
- **Chip** — a short verb or state set in front of a line of text ("審核", "處理中").
- **Button** — `primary` (white pill), `secondary` (glass), `ghost`, `danger`; every button is a pill.
- **Segmented** — mutually exclusive views; the white pill slides between options.
- **Pane** — the content behind a Segmented control or any row of sibling views (feed views and categories, admin sections and tabs). A view further along slides in from the right, one before it from the left; nothing is remounted, so a view keeps its draft.
- **PrimaryNav** — the primary destinations: a floating `dock` on phones, a `rail` in the glass sidebar from `md` up. The current one wears the white pill and its icon fills.
- **ListGroup / ListRow** — settings-style rows: link, action, or label with a trailing control.
- **Field / Input / Textarea / Switch / Avatar** — form controls and identity.
- **Sheet** — bottom sheet on phones, centred panel from `md` up (`size="screen"` for records and composers: 86% of the screen's width and height, so it keeps the screen's proportions); every exit goes through `onOpenChange`, and `onClosed` fires once the exit has finished.
- **Dialog / ConfirmDialog / DecisionSheet** — a centred question, an irreversible confirmation, and one recorded decision with its reason.
- **Select / Menu / Popover / Tooltip** — a choice, the actions on a thing, a small form, and a label for an icon-only control on real pointers.
- **PageHeader / EmptyState / ErrorState / LoadingList / SaveBar** — page furniture and the one explicit-save bar.
- **Spinner / Skeleton / ProgressBar / Toaster / AnimatedNumber** — loading, progress and feedback.
- **DecodedImage / ImageGrid / ImageTile / ImageLightbox** — attachments: fitted tiles that decode before they show, and the lightbox they open.

## Rules

- Icons are Phosphor (`@phosphor-icons/react/ssr`): `regular` at rest, `fill` for the selected state, `bold` for small glyphs such as chevrons.
- Colour comes from tokens only. Emphasis comes from the white pill, not from hue.
- Status colours describe state; they never become a control's theme.
- Motion durations and curves come from the motion ladder; no raw `duration-*`, springs or inline easing.
- Nothing appears or leaves on a single frame. Content that replaces a placeholder or joins a list wears `content-in`, a message that appears under a control wears `message-in`, a proportion bar wears `bar-in`, and a block that can also leave uses `Reveal` inside `AnimatePresence`. Switching between sibling views moves sideways through `Pane`, never up from below. Each falls back to a plain fade under reduced motion.
- Hover styles go through the `hover:` variant, which is gated to real pointers.
- Primitives in `src/ui` do not import hooks or services; features reach data only through hooks.
- A record (proposal, facility report, announcement) or a composer is always framed by `RecordSheet` over its feed, whether it was opened from the feed or loaded by its URL. On a phone it fills the screen and the dock steps aside.
- A scrolling edge is never a hard cut: `PageHeader` sticks to the top over an `edge-top` blur, the shell fades content under the dock or window bottom with `edge-bottom`, and scrolling areas inside layers use `edge-fade`.
- Check every screen at phone width (375px) and desktop, with safe areas and reduced motion.
