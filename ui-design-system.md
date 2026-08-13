# UI design system

The active, implementation-level design language is documented in [`DESIGN.md`](./DESIGN.md).

The enforced sources of truth are:

- `src/app/globals.css` for semantic colors, typography, radii, surfaces, shadows, safe areas, and viewport layout.
- `src/styles/motion.css` for timing, easing, entrance/exit recipes, loading/success feedback, hover capability, and reduced-motion behavior.
- `src/components/ui/` for business-free shadcn/Radix primitives.
- `src/components/motion/` for reusable state-change motion.
- `scripts/check-ui-primitives.mjs` for architecture and visual-system constraints.

Do not create page-local parallel button, card, field, overlay, navigation, elevation, or motion systems. Pages and domain components must consume the shared tokens and primitives.
