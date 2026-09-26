# Novae official website

The `website/` directory builds the public product introduction for GitHub Pages. It is independent of the Next.js application deployed to Vercel; no app route or shared app component inherits this design.

## Direction

The page explains how a campus issue moves from a first report to a result people can revisit. A contemporary campus planning sheet guides the composition: architectural photography, direct wayfinding, a connected route, and Novae blue used for action and progress.

## Visual system

- Cool concrete gray and near-white surfaces, deep blue-gray text, and one cobalt accent. System dark mode keeps the same color family with a lighter blue for contrast.
- HarmonyOS Sans TC carries Chinese text. Barlow Condensed gives English headings the character of campus signage. Both are self-hosted by the Vite build.
- Rectangular photography and controls with a 4px radius. Large sections use spacing and contrast rather than decorative shadows.
- A split first viewport, a four-stop process route, an asymmetric capability composition, a two-role explanation, native FAQ disclosures, and an open-source close.
- Campus photographs are visibly labeled as illustrative. The Novae constellation is an existing brand asset, not a product screenshot. See [ASSETS.md](ASSETS.md).

## Interaction and accessibility

The route line reveals once as the process enters view. Reduced-motion users see it immediately. The site has a skip link, visible focus rings, semantic headings, native FAQ controls, and a bilingual language toggle. English and Traditional Chinese catalogs have matching keys. The dark palette follows the user's system preference.
