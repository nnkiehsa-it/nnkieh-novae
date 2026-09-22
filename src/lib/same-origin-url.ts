/** Resolve untrusted redirect/notification links without leaving this application. */
export function sameOriginUrl(value: unknown, origin: string, fallback = "/") {
  const base = new URL(origin);
  const defaultUrl = new URL(fallback, base).href;
  if (typeof value !== "string" || !value.trim()) return defaultUrl;
  try {
    const url = new URL(value, base);
    return url.origin === base.origin && (url.protocol === "https:" || url.protocol === "http:")
      ? url.href : defaultUrl;
  } catch {
    return defaultUrl;
  }
}
