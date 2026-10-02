import { createMediaDeliveryUrl } from "../shared/media-delivery.ts";
import { platformAdminEmails } from "../shared/platform-admin.ts";
import type { BackendDatabase } from "./types.ts";
import type { Selected } from "../database/schema.ts";

type AccessProfile = Selected<"user_profiles", "uid" | "email" | "display_name" | "avatar_public_id" | "photo_url"> & {
  roles: string[];
  issue_ids: string[];
  facility_ids: string[];
};

/** Profile and permission metadata come from one PostgreSQL statement snapshot. */
export async function accessUsersForUids(uids: string[], database: BackendDatabase, viewerUid: string, excludePlatformAdmins = true) {
  if (uids.length === 0) return [];
  const admins = new Set(platformAdminEmails());
  const { rows } = await database.sql<AccessProfile>`
    select profile.uid, profile.email, profile.display_name, profile.avatar_public_id, profile.photo_url,
      array(select role_code from app_private.user_role_assignments where uid = profile.uid order by role_code) as roles,
      array(select category_id from app_private.user_issue_category_assignments where uid = profile.uid order by category_id) as issue_ids,
      array(select category_id from app_private.user_facility_category_assignments where uid = profile.uid order by category_id) as facility_ids
    from app_private.user_profiles profile where uid = any(${uids}) order by display_name, uid`;
  return Promise.all(rows.filter((profile) => !excludePlatformAdmins || !admins.has(profile.email?.trim().toLowerCase() ?? ""))
    .map(async (profile) => {
      const media = profile.avatar_public_id
        ? await createMediaDeliveryUrl(profile.avatar_public_id, "avatar", false, viewerUid) : null;
      return {
        uid: profile.uid, email: profile.email,
        name: profile.display_name ?? profile.email ?? profile.uid,
        photoUrl: media?.url ?? profile.photo_url,
        roles: [...profile.roles.filter((role) => role !== "platform-admin"),
          ...(admins.has(profile.email?.trim().toLowerCase() ?? "") ? ["platform-admin"] : [])].sort(),
        managedIssueCategoryIds: profile.issue_ids, managedFacilityCategoryIds: profile.facility_ids,
      };
    }));
}
