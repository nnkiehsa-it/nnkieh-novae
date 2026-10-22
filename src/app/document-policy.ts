import { THEME_BOOT_SCRIPT } from "../lib/theme";

/**
 * The one script written into the page. It sets the theme before first paint,
 * then starts the app from the entry named in `<meta name="novae-entry">`.
 *
 * Its text never changes between builds, so its hash can sit in a fixed
 * Content-Security-Policy header. Under `'strict-dynamic'` the module scripts
 * it inserts are trusted, and so is everything they import; a script typed
 * into the HTML is not. The loader accepts only bundles under `/assets/`, so a
 * forged meta tag cannot point it anywhere else.
 */
export const DOCUMENT_BOOT_SCRIPT = `${THEME_BOOT_SCRIPT};(function(){var m=document.querySelector('meta[name="novae-entry"]');if(!m)return;var f=m.content.split(" ").filter(function(u){return/^\\/assets\\/[\\w.-]+\\.js$/.test(u)});if(!f.length)return;for(var i=1;i<f.length;i++){var l=document.createElement("link");l.rel="modulepreload";l.href=f[i];document.head.appendChild(l)}var s=document.createElement("script");s.type="module";s.src=f[0];document.head.appendChild(s)})()`;

const SCRIPT_HOSTS = [
  "https://accounts.google.com",
  "https://apis.google.com",
  "https://www.google.com/recaptcha/",
  "https://www.gstatic.com/recaptcha/",
  "https://challenges.cloudflare.com/",
  "https://unpkg.com",
];

const LOCAL_HOSTS = ["http://127.0.0.1:*", "http://localhost:*"];
const LOCAL_SOCKETS = ["ws://127.0.0.1:*", "ws://localhost:*"];

/**
 * Whether a build talks to the isolated local test stack: the integration
 * domain with the Auth Emulator on loopback. Only such a build may reach
 * loopback addresses.
 */
export function isIsolatedLocalBuild(environment: { allowedDomain?: string; authEmulatorUrl?: string }) {
  return environment.allowedDomain === "integration.invalid"
    && /^http:\/\/(?:127\.0\.0\.1|localhost):9099\/?$/u.test(environment.authEmulatorUrl ?? "");
}

/**
 * The policy every page is served with. `bootScriptHash` is the base64
 * SHA-256 of DOCUMENT_BOOT_SCRIPT. `local` adds the loopback origins of the
 * test stack, and is never set for a deployment.
 */
export function contentSecurityPolicy({ bootScriptHash, local = false }: { bootScriptHash: string; local?: boolean }) {
  const localImages = local ? ` ${LOCAL_HOSTS.join(" ")}` : "";
  const localConnections = local ? ` ${[...LOCAL_HOSTS, ...LOCAL_SOCKETS].join(" ")}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'sha256-${bootScriptHash}' 'strict-dynamic' 'wasm-unsafe-eval' ${SCRIPT_HOSTS.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    "font-src 'self' data:",
    `img-src 'self' data: blob: https:${localImages}`,
    `connect-src 'self' https: wss:${localConnections}`,
    "frame-src https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** The headers every response carries besides the policy. */
export const DOCUMENT_HEADERS = {
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
} as const;
