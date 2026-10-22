import { access, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import configuredLimits from "../config/build-budget.config.json" with { type: "json" };
import { measureCss, measureJs, measureRoute } from "./build-budget-metrics.mjs";

const buildDirectory = path.resolve(process.env.NOVAE_DIST_DIR || "dist");
const manifestPath = path.join(buildDirectory, ".vite", "manifest.json");

// Each screen as src/app/routes.tsx loads it. A record or composer opens over
// the feed, so it carries the feed too.
const feed = "src/features/feed/feed-page.tsx";
const ROUTES = [
  ["/login", ["src/features/auth/login-page.tsx"]],
  ["/setup", ["src/features/setup/setup-page.tsx"]],
  ["/home", ["src/features/home/home-page.tsx"]],
  ["/feed", [feed]],
  ["/notifications", ["src/features/notifications/notifications-page.tsx"]],
  ["/settings", ["src/features/settings/settings-page.tsx"]],
  ["/issues/:filter/:id", [feed, "src/features/issues/issue-detail.tsx"]],
  ["/issues/:filter/compose/new", [feed, "src/features/issues/issue-composer.tsx"]],
  ["/facilities/:id", [feed, "src/features/facilities/facility-detail.tsx"]],
  ["/facilities/new", [feed, "src/features/facilities/facility-composer.tsx"]],
  ["/announcements/:id", [feed, "src/features/announcements/announcement-detail.tsx"]],
  ["/announcements/new", [feed, "src/features/announcements/announcement-composer.tsx"]],
  ["/admin", ["src/features/admin/shell/admin-layout.tsx", "src/features/admin/overview/admin-overview.tsx"]],
  ...["audit/audit-console", "content/content-console", "people/people-console", "platform/platform-console", "policies/policy-console", "system/system-console"]
    .map((module) => [`/admin/${module.split("/")[0]}`, ["src/features/admin/shell/admin-layout.tsx", `src/features/admin/${module}.tsx`]]),
].map(([route, entries]) => ({ route, entries: ["index.html", ...entries] }));

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(name));
    else files.push({ name, size: (await stat(name)).size });
  }
  return files;
}

try {
  await access(manifestPath);
} catch {
  throw new Error(`Build manifest not found at ${manifestPath}. Run a production build before checking the asset budget.`);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const assets = (await listFiles(path.join(buildDirectory, "assets")))
  .map((asset) => ({ ...asset, file: path.relative(buildDirectory, asset.name).split(path.sep).join("/") }));
const bytesFor = (extension) => assets.filter((asset) => asset.name.endsWith(extension)).reduce((total, asset) => total + asset.size, 0);
const measure = async (extension, measurer) => new Map(await Promise.all(assets
  .filter((asset) => asset.name.endsWith(extension))
  .map(async ({ file, name }) => [file, measurer(await readFile(name, "utf8"))])));
const cssAssets = await measure(".css", measureCss);
const jsAssets = await measure(".js", measureJs);
const routes = ROUTES.map((route) => measureRoute(route, manifest, { css: cssAssets, js: jsAssets }));
routes.sort((a, b) => b.jsGzipBytes - a.jsGzipBytes);

// Administration is its own chunk family; no other screen may pull it in.
const adminFiles = new Set(Object.entries(manifest).filter(([key]) => key.startsWith("src/features/admin/")).map(([, chunk]) => chunk.file));
const leaks = routes
  .filter(({ route }) => !route.startsWith("/admin"))
  .flatMap(({ route, scripts }) => scripts.filter((file) => adminFiles.has(file)).map((file) => `${route} loads ${file}`));
if (leaks.length) throw new Error(`Administration code leaked into other screens:\n${leaks.join("\n")}`);

const actual = {
  maxRouteCssUiBytes: Math.max(...routes.map((route) => route.uiBytes)),
  maxRouteCssGzipBytes: Math.max(...routes.map((route) => route.gzipBytes)),
  // Also guards styles loaded on demand, such as the Markdown editor.
  maxCssChunkGzipBytes: Math.max(...[...cssAssets.values()].map((asset) => asset.gzipBytes)),
  maxRouteJsGzipBytes: Math.max(...routes.map((route) => route.jsGzipBytes)),
  cssFontFaceBytes: [...cssAssets.values()].reduce((total, asset) => total + asset.fontFaceBytes, 0),
  fontBytes: bytesFor(".woff2"),
  jsBytes: bytesFor(".js"),
};
const limits = { ...configuredLimits };
const environmentOverrides = {
  maxRouteCssUiBytes: "NOVAE_ROUTE_CSS_UI_BUDGET_BYTES",
  maxRouteCssGzipBytes: "NOVAE_ROUTE_CSS_GZIP_BUDGET_BYTES",
  maxCssChunkGzipBytes: "NOVAE_CSS_CHUNK_GZIP_BUDGET_BYTES",
  maxRouteJsGzipBytes: "NOVAE_ROUTE_JS_GZIP_BUDGET_BYTES",
  cssFontFaceBytes: "NOVAE_FONT_FACE_CSS_BUDGET_BYTES",
  fontBytes: "NOVAE_FONT_BUDGET_BYTES",
  jsBytes: "NOVAE_JS_BUDGET_BYTES",
};
if (process.env.NOVAE_CSS_BUDGET_BYTES) {
  throw new Error("NOVAE_CSS_BUDGET_BYTES was replaced by the route UI, route gzip and font-face CSS budgets. Update the environment override.");
}
if (process.env.NOVAE_NEXT_DIST_DIR) {
  throw new Error("NOVAE_NEXT_DIST_DIR was renamed to NOVAE_DIST_DIR. Update the environment override.");
}
for (const [metric, variable] of Object.entries(environmentOverrides)) {
  if (process.env[variable] === undefined) continue;
  const value = Number(process.env[variable]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${variable} must be a positive byte count.`);
  limits[metric] = value;
}

const reportPath = path.join(buildDirectory, ".vite", "build-budget-report.json");
const inventory = { cssBytes: bytesFor(".css"), fontFiles: assets.filter((asset) => asset.name.endsWith(".woff2")).length, jsFiles: jsAssets.size };
await writeFile(reportPath, `${JSON.stringify({ actual, limits, inventory, routes, cssAssets: Object.fromEntries(cssAssets) }, null, 2)}\n`);
const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
console.info(`CSS inventory: ${kib(inventory.cssBytes)} raw; ${kib(actual.cssFontFaceBytes)} font declarations.`);
console.info(`Largest initial route CSS: ${kib(actual.maxRouteCssUiBytes)} UI raw; ${kib(actual.maxRouteCssGzipBytes)} gzip estimate (including fonts).`);
console.info(`Largest initial route JS: ${kib(actual.maxRouteJsGzipBytes)} gzip estimate.`);
for (const route of routes.slice(0, 3)) console.info(`  ${route.route}: ${kib(route.jsGzipBytes)} JS, ${kib(route.gzipBytes)} CSS gzip estimate, ${route.scripts.length} scripts`);
console.info(`Report: ${reportPath}`);

const exceeded = Object.entries(limits).filter(([metric, limit]) => actual[metric] > limit).map(([metric, limit]) => `${metric}: ${actual[metric]} > ${limit}`);
if (exceeded.length) throw new Error(`Build budget exceeded:\n${exceeded.join("\n")}\nSee ${reportPath} for affected routes and assets.`);
const warnings = Object.entries(limits).filter(([metric, limit]) => actual[metric] >= limit * 0.85).map(([metric, limit]) => `${metric}: ${actual[metric]} / ${limit}`);
if (warnings.length) console.warn(`Build budget warning (>=85%):\n${warnings.join("\n")}`);
console.info(`Build budget passed: ${inventory.fontFiles} fonts, ${kib(actual.fontBytes)} font inventory, ${inventory.jsFiles} scripts, ${kib(actual.jsBytes)} JS inventory.`);
