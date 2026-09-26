# Novae official website

This static, bilingual product site is built from the main Novae repository and published to GitHub Pages at the project site's root (`/novae/`). The Next.js application remains on Vercel with its existing routes and is built independently.

## Local development

```bash
npm ci --prefix website
npm run dev --prefix website
```

## Verify and build

```bash
npm run build --prefix website
```

The build checks that the Traditional Chinese and English catalogs have the same keys, then writes the static site to `website/dist/`. The GitHub Pages workflow sets `GITHUB_PAGES_BASE=/novae/` so Vite emits the correct project-path asset URLs.

The public site's actions link to the verified [source repository](https://github.com/tavricccc/novae) and its documentation. No application URL is assumed.

Before the first deployment, enable Pages in this repository's Settings and set the publishing source to **GitHub Actions**. The workflow builds `website/` on `main` changes and uploads only its static output.
