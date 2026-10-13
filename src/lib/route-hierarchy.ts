import { ADMIN_ROUTES } from "./admin-routes";
import { feedHref } from "./feed-href";

/**
 * What one in-app address shows. The whole signed-in app is one client
 * bundle, so this table, not the file system, decides which screen a path is.
 */
export type AppRoute =
  | { kind: "view"; view: "home" | "feed" | "notifications" | "settings" }
  | { kind: "admin"; section: string | null }
  | { kind: "issue"; filter: string; id: string }
  | { kind: "issue-composer"; filter: string }
  | { kind: "facility"; id: string }
  | { kind: "facility-composer" }
  | { kind: "announcement"; id: string }
  | { kind: "announcement-composer" }
  | { kind: "redirect"; href: string };

const VIEWS = new Set(["home", "feed", "notifications", "settings"]);

function segment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Reads an in-app path; anything unknown forwards home. */
export function matchAppRoute(pathname: string): AppRoute {
  const parts = pathname.split("/").filter(Boolean);
  const [head, second, third, fourth] = parts;
  if (parts.length === 1 && VIEWS.has(head)) return { kind: "view", view: head as "home" };
  if (head === "admin" && parts.length === 1) return { kind: "admin", section: null };
  if (head === "admin" && parts.length === 2) {
    return ADMIN_ROUTES.some((route) => route.href === `/admin/${second}`)
      ? { kind: "admin", section: second }
      : { href: "/admin", kind: "redirect" };
  }
  if (head === "issues") {
    if (parts.length === 3 && third !== "new") return { filter: segment(second), id: segment(third), kind: "issue" };
    if (parts.length === 4 && third === "compose" && fourth === "new") return { filter: segment(second), kind: "issue-composer" };
    if (parts.length <= 2) return { href: feedHref("issues", second ? segment(second) : null), kind: "redirect" };
  }
  if (head === "facilities") {
    if (parts.length === 2) return second === "new" ? { kind: "facility-composer" } : { id: segment(second), kind: "facility" };
    if (parts.length === 1) return { href: feedHref("facilities"), kind: "redirect" };
  }
  if (head === "announcements") {
    if (parts.length === 2) return second === "new" ? { kind: "announcement-composer" } : { id: segment(second), kind: "announcement" };
    if (parts.length === 1) return { href: feedHref("announcements"), kind: "redirect" };
  }
  return { href: "/home", kind: "redirect" };
}

/** Whether `pathname` opens over a list rather than replacing the screen. */
export function isLayeredRoute(route: AppRoute) {
  return route.kind !== "view" && route.kind !== "admin" && route.kind !== "redirect";
}

/** A page that is one piece of content, and so can be sent to somebody alone. */
export function isRecordRoute(pathname: string) {
  const { kind } = matchAppRoute(pathname);
  return kind === "issue" || kind === "facility" || kind === "announcement";
}

/**
 * The primary destination `pathname` belongs to: a record or a composer is
 * part of the feed, and administration is part of settings.
 */
export function primaryDestination(pathname: string) {
  if (/^\/(?:issues|facilities|announcements)(?:\/|$)/u.test(pathname)) return "/feed";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "/settings";
  return pathname;
}

/** A record or composer fills a phone screen with its own actions, so the dock steps aside. */
export function hidesDock(pathname: string) {
  return pathname === "/setup" || isLayeredRoute(matchAppRoute(pathname));
}
