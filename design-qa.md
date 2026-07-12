# Design QA

- Source visual truth: `C:\Users\tavri\AppData\Local\Temp\codex-clipboard-386bf9ec-c922-4fae-a100-37f45cca88a7.png`
- Implementation screenshot: unavailable
- Viewport: 1919 × 985 desktop
- State: Traditional Chinese deployment lesson, GitHub chapter selected

## Full-view comparison evidence

The supplied source screenshot was opened at original resolution. It shows a 720px reading column inside a much wider content region, section dividers nearly touching their following headings, an oversized header brandmark, and a nested documentation route whose header Docs link resolves within the nested directory.

The project instructions prohibit in-app browser preview. No post-change browser-rendered screenshot is available, so a same-viewport visual comparison cannot be completed.

## Focused region comparison evidence

Source regions were inspected for the documentation header, sidebar/subnavigation, content column, section dividers, and brandmark. Code-level measurements were compared with the application brandmark implementation. The app renders the mark at `1em`; the marketing site previously forced it to 48 × 40px.

## Findings and fixes

- P1 — Nested Docs navigation could resolve to the current subdirectory. Fixed by generating an explicit documentation-home URL and adding a visible deployment-overview return link.
- P1 — The documentation layout left excessive unused width. Fixed by expanding the shell to 1680px and the reading surface to 1080px.
- P2 — Section rules and headings were visually crowded. Fixed by increasing the heading's top padding from 0.4rem to 1.75rem and its section margin.
- P2 — Marketing and embedded-demo brandmarks were substantially larger than the application mark. Fixed by reducing them from 48 × 40px to 24 × 20px.
- P1 — The category-rules section exposed configuration identifiers instead of explaining outcomes. Fixed by replacing code snippets with interactive, plain-language scenario summaries.

## Comparison history

1. Initial source review identified the five user-reported issues above.
2. Layout, navigation, brand sizing, and category presentation were updated in source.
3. Post-fix rendered comparison could not be captured because repository instructions disallow in-app browser preview.

## Remaining verification

- Confirm the 1080px reading width and divider rhythm at 1919 × 985.
- Confirm every nested Docs header and overview pill returns to a valid parent page.
- Confirm the 24 × 20px mark matches the live application visually.
- Confirm all four participation scenarios switch correctly in both languages.

final result: blocked

Blocker: a browser-rendered implementation screenshot is required for visual QA, but repository instructions explicitly prohibit in-app browser preview.
