import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { serwist } from "@serwist/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { APP_DESCRIPTION } from "./src/constants/app";
import {
  contentSecurityPolicy,
  DOCUMENT_BOOT_SCRIPT,
  DOCUMENT_HEADERS,
  isIsolatedLocalBuild,
} from "./src/app/document-policy";
import { webManifest } from "./src/app/web-manifest";

const root = import.meta.dirname;
const outDir = process.env.NOVAE_DIST_DIR || "dist";

const appVersion =
  process.env.NEXT_PUBLIC_APP_VERSION ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.npm_package_version ||
  "development";

// Browser-visible settings keep their NEXT_PUBLIC_ names so deployment
// environments need no change. Each is written into the bundle at build time.
const publicEnvironment: Record<string, string> = {
  NEXT_PUBLIC_ALLOWED_DOMAIN: process.env.NEXT_PUBLIC_ALLOWED_DOMAIN || "",
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "",
  NEXT_PUBLIC_APP_VERSION: appVersion,
  NEXT_PUBLIC_CONTENT_REALTIME_ENABLED: process.env.NEXT_PUBLIC_CONTENT_REALTIME_ENABLED || "",
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED: process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED || "false",
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL || "",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "",
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
  NEXT_PUBLIC_LOCAL_DEV_AUTH: process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH || "false",
  NEXT_PUBLIC_LOCAL_DEV_AUTH_EMAIL: process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH_EMAIL || "admin@integration.invalid",
  NEXT_PUBLIC_LOCAL_TEST_ORIGIN: process.env.NEXT_PUBLIC_LOCAL_TEST_ORIGIN || "",
  NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY || "",
  NEXT_PUBLIC_SCHOOL_NAME: process.env.NEXT_PUBLIC_SCHOOL_NAME || "",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim(),
};

const bootScriptHash = createHash("sha256").update(DOCUMENT_BOOT_SCRIPT).digest("base64");
const localBuild = isIsolatedLocalBuild({
  allowedDomain: publicEnvironment.NEXT_PUBLIC_ALLOWED_DOMAIN,
  authEmulatorUrl: publicEnvironment.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL,
});
const noCache = { "Cache-Control": "no-cache, no-store, must-revalidate" };

/**
 * Everything Next used to answer at request time, settled at build time: the
 * document head, `/version.json`, `/manifest.webmanifest`, and a script loader
 * whose fixed text the deployed Content-Security-Policy trusts by hash.
 */
function novaeDocument(): Plugin {
  const versionJson = `${JSON.stringify({ version: appVersion })}\n`;
  const manifestJson = `${JSON.stringify(webManifest(appVersion), null, 2)}\n`;
  const turnstileHints = publicEnvironment.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    ? '<link rel="preconnect" href="https://challenges.cloudflare.com" crossorigin="anonymous"><link rel="dns-prefetch" href="https://challenges.cloudflare.com">'
    : "";
  return {
    name: "novae-document",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = (request.url ?? "").split("?")[0];
        if (pathname !== "/version.json" && pathname !== "/manifest.webmanifest") return next();
        response.setHeader("Content-Type", pathname === "/version.json" ? "application/json" : "application/manifest+json");
        if (pathname === "/version.json") for (const [key, value] of Object.entries(noCache)) response.setHeader(key, value);
        response.end(pathname === "/version.json" ? versionJson : manifestJson);
      });
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html
          .replaceAll("%NOVAE_VERSION%", encodeURIComponent(appVersion))
          .replaceAll("%NOVAE_DESCRIPTION%", APP_DESCRIPTION)
          .replace("<!-- novae:boot -->", `<script>${DOCUMENT_BOOT_SCRIPT}</script>${turnstileHints}`);
      },
    },
    generateBundle() {
      this.emitFile({ fileName: "version.json", source: versionJson, type: "asset" });
      this.emitFile({ fileName: "manifest.webmanifest", source: manifestJson, type: "asset" });
    },
  };
}

/**
 * A built page carries no script tag of its own: the entry and its preloads
 * move into `<meta name="novae-entry">`, where the boot script picks them up.
 * The build also refuses to finish if the deployed header no longer trusts
 * the boot script.
 */
function novaeScriptLoader(): Plugin {
  return {
    apply: "build",
    name: "novae-script-loader",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const entries: string[] = [];
        const preloads: string[] = [];
        const rest = html
          .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>\s*/gu, (_, src: string) => {
            entries.push(src);
            return "";
          })
          .replace(/<link rel="modulepreload" crossorigin href="([^"]+)">\s*/gu, (_, href: string) => {
            preloads.push(href);
            return "";
          });
        if (entries.length !== 1) throw new Error(`Expected one entry script in index.html, found ${entries.length}.`);
        const files = [...entries, ...preloads];
        const unsafe = files.find((file) => !/^\/assets\/[\w.-]+\.js$/u.test(file));
        if (unsafe) throw new Error(`The boot loader only starts /assets/*.js bundles, not ${unsafe}.`);
        if (rest.replace(`<script>${DOCUMENT_BOOT_SCRIPT}</script>`, "").includes("<script")) {
          throw new Error("index.html may contain no script but the boot script; the deployed policy would block it.");
        }
        return rest.replace("</title>", `</title>\n    <meta name="novae-entry" content="${files.join(" ")}">`);
      },
    },
    closeBundle() {
      const vercel = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8")) as {
        headers: Array<{ headers: Array<{ key: string; value: string }> }>;
      };
      const deployed = vercel.headers.flatMap((rule) => rule.headers).find((header) => header.key === "Content-Security-Policy");
      const expected = contentSecurityPolicy({ bootScriptHash });
      if (deployed?.value !== expected) {
        throw new Error(`vercel.json must serve this Content-Security-Policy:\n${expected}`);
      }
    },
  };
}

export default defineConfig(({ command }) => ({
  build: {
    outDir,
    emptyOutDir: true,
    // Read by the build budget to measure what each screen downloads.
    manifest: true,
    target: "es2022",
    // Each screen is its own chunk; these vendors change rarely, so they get
    // their own files and stay cached across deployments.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "vendor-react", test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler|react-router)[\\/]/u, priority: 40 },
            { name: "vendor-firebase", test: /[\\/]node_modules[\\/](?:@firebase|firebase|idb)[\\/]/u, priority: 30 },
            { name: "vendor-motion", test: /[\\/]node_modules[\\/](?:motion|motion-dom|motion-utils|framer-motion)[\\/]/u, priority: 30 },
            { name: "vendor-radix", test: /[\\/]node_modules[\\/](?:@radix-ui|radix-ui)[\\/]/u, priority: 30 },
            { name: "vendor-markdown", test: /[\\/]node_modules[\\/](?:marked|dompurify)[\\/]/u, priority: 30 },
          ],
        },
      },
    },
  },
  define: Object.fromEntries(
    Object.entries(publicEnvironment).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]),
  ),
  plugins: [
    react(),
    novaeDocument(),
    novaeScriptLoader(),
    serwist({
      // The local test stack serves a production build without a service
      // worker, so a stale cache can never answer for the code under test.
      disable: command === "serve" || process.env.NOVAE_LOCAL_TEST_PREVIEW === "true",
      globDirectory: outDir,
      // Font shards stay out of the install-time precache: the browser loads
      // the unicode ranges a page needs, and the runtime cache keeps them.
      globIgnores: ["**/*.woff2", "sw.js", "version.json", "docs/**"],
      globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,webmanifest}"],
      injectionPoint: "self.__SW_MANIFEST",
      rollupFormat: "iife",
      swDest: path.resolve(root, outDir, "sw.js"),
      swSrc: "src/app/sw.ts",
    }),
  ],
  preview: {
    headers: {
      ...DOCUMENT_HEADERS,
      "Content-Security-Policy": contentSecurityPolicy({ bootScriptHash, local: localBuild }),
    },
  },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
      "@shared": path.join(root, "shared"),
    },
  },
  server: {
    allowedHosts: ["127.0.0.1", ...(process.env.NOVAE_TEST_PUBLIC_ORIGIN ? [new URL(process.env.NOVAE_TEST_PUBLIC_ORIGIN).hostname] : [])],
  },
}));
