import type { AdminUser } from "@/hooks/use-admin-console";
import type { Translate } from "../shared/translate";

export type Standing = "admin" | "normal" | "restricted";

export function isPlatformAdmin(user: AdminUser) {
  return user.roles.includes("platform-admin");
}

/** Platform admins cannot be restricted, so their standing never reads as restricted. */
export function standingOf(user: AdminUser): Standing {
  if (isPlatformAdmin(user)) return "admin";
  return user.accessRule ? "restricted" : "normal";
}

/** What this person looks after, in a few words; empty when nothing. */
export function responsibilityLabel(user: AdminUser, t: Translate) {
  const labels: string[] = [];
  if (isPlatformAdmin(user)) labels.push(t("ui.adminConsole.platformAdmin"));
  if (user.roles.includes("announcement-manager")) labels.push(t("ui.adminConsole.announcementScope"));
  if (user.managedIssueCategoryIds.length > 0) labels.push(t("ui.adminConsole.issueScope", { count: user.managedIssueCategoryIds.length }));
  if (user.managedFacilityCategoryIds.length > 0) labels.push(t("ui.adminConsole.facilityScope", { count: user.managedFacilityCategoryIds.length }));
  return labels.join(" · ");
}
