# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Novae serves members of a school community using an installable web app to raise, review, support, discuss, and follow matters that affect their campus. Platform administrators and category-scoped managers use the same app to configure categories, moderate workflows, publish announcements, manage facilities reports, and monitor operations.

## Product Purpose

Novae gives a school community one accountable place for public proposals, private rights-related cases, facility reports, announcements, discussion, notifications, and follow-up. Success means that community members can understand the state of an issue and take the appropriate action, while administrators can manage each workflow within explicit category and permission boundaries.

## Positioning

The product combines community-facing participation with category-scoped operational administration. Proposal visibility, author display, support thresholds, deadlines, responsible managers, notification recipients, and comment availability are configurable without weakening backend-enforced access boundaries.

## Operating Context

- Community members commonly use the PWA on phones and may return through in-app or Web Push notifications.
- Desktop and tablet layouts support denser review, administration, setup, and dashboard work.
- The primary content domains are proposals, facilities, announcements, comments, and notifications.
- Initial setup confirms language before configuring at least one proposal category and one facility category.
- The interface is bilingual in Traditional Chinese and English.

## Capabilities and Constraints

- Firebase Google authentication is restricted to the configured school domain.
- The Cloudflare Workers API enforces authorization and uses a least-privilege Neon runtime role; frontend conditions only control presentation and the browser has no database credentials.
- Platform administrators are derived only from the backend `ADMIN_EMAILS` environment variable.
- General managers are scoped by category and cannot bypass that scope with a global frontend permission.
- Existing routes, navigation information architecture, workflows, data flow, API contracts, authentication behavior, backend logic, and database schema must remain stable during the frontend redesign.
- The production frontend is an installable Next.js 16 App Router PWA using React 19 and TypeScript 7.

## Brand Commitments

- The product name is Novae.
- Existing product terminology, bilingual copy, logo, and familiar task locations are preserved.
- The frontend may receive a complete new design language, but it must still feel like the same product with the same information architecture and operations.

## Evidence on Hand

- Product capabilities and constraints are documented in `README.md`, `AGENTS.md`, `structure.md`, and the route, i18n, component, composable, and test suites.
- Existing PWA icons, logo assets, bilingual interface copy, accessibility behavior, and automated interaction tests are present in the repository.
- No customer claims, testimonials, outcome benchmarks, or usage statistics are available and must not be invented.

## Product Principles

- Preserve task clarity and familiar operations while improving presentation.
- Keep permissions and scope explicit at every administrative boundary.
- Treat mobile as an intentional operating surface, not a scaled-down desktop layout.
- Make state, progress, success, failure, and recoverability legible.
- Centralize reusable frontend decisions so new surfaces inherit the same system.

## Accessibility & Inclusion

The web app must preserve semantic labels, keyboard behavior, focus management, safe-area handling, 100dvh layouts, adequate touch targets, reduced-motion behavior, and complete light/dark presentation. Traditional Chinese and English must remain equally supported.
