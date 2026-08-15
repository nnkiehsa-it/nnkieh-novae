import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

function createContentSecurityPolicy(nonce: string) {
  const isolatedLocalAuth =
    process.env.NEXT_PUBLIC_ALLOWED_DOMAIN === "integration.invalid" &&
    /^http:\/\/(?:127\.0\.0\.1|localhost):9099\/?$/u.test(
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL ?? "",
    );
  const localConnections =
    process.env.NODE_ENV === "development" || isolatedLocalAuth
      ? " http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*"
      : "";
  const webAssemblyScripts = " 'wasm-unsafe-eval'";
  const developmentScripts =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${webAssemblyScripts}${developmentScripts} https://accounts.google.com https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
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

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(randomUUID()).toString("base64");
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)",
  ],
};
