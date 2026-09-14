import { createMediaDeliveryUrls } from "../shared/media-delivery.ts";
import { asString } from "../shared/http.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { canReadIssue } from "./issue-shared.ts";
import type { Selected } from "../database/schema.ts";

/**
 * Who may see an uploaded image, and how it reaches them.
 *
 * An upload carries no permissions of its own: it inherits them from whatever
 * it is attached to, so answering "may this person see it" means reading that
 * target. Resolving a whole batch therefore reads each kind of target once
 * rather than once per image, and the answer also says whether the image must
 * be delivered privately — an image on a hidden or still-under-review issue
 * may not be handed out through a cacheable URL.
 */
function issueDeliveryAccess(
  issue: JsonRecord | undefined,
  auth: AuthContext,
) {
  if (!issue) return { allowed: false, privateDelivery: true };
  return {
    allowed: canReadIssue(issue, auth),
    privateDelivery: issue.read_access === "owner-admin"
      || (issue.read_access === "reviewed-school"
        && ["under-review", "review-rejected"].includes(asString(issue.status))),
  };
}

async function resolveUploadAccessBatch(
  uploads: JsonRecord[],
  auth: AuthContext,
  database: BackendDatabase,
) {
  const issueIds = new Set<string>();
  const commentIds = new Set<string>();
  for (const upload of uploads) {
    const type = asString(upload.attached_target_type);
    const id = asString(upload.attached_target_id);
    if (type === "issue" && id) issueIds.add(id);
    if (type === "comment" && id) commentIds.add(id);
  }
  const commentToIssue = new Map<string, string>();
  if (commentIds.size > 0) {
    const { rows } = await database.sql<Selected<"comments", "id" | "issue_id">>`
      select id, issue_id from app_private.comments where id = any(${[...commentIds]})`;
    for (const comment of rows) {
      commentToIssue.set(String(comment.id), String(comment.issue_id));
      issueIds.add(String(comment.issue_id));
    }
  }
  const issues = new Map<string, JsonRecord>();
  const facilityIds = uploads.filter((upload) => asString(upload.attached_target_type) === "facility")
    .map((upload) => asString(upload.attached_target_id)).filter(Boolean);
  const availableFacilities = new Set<string>();
  if (facilityIds.length > 0) {
    const { rows } = await database.sql<Selected<"facility_reports", "id">>`
      select id from app_private.facility_reports where id = any(${facilityIds})`;
    for (const facility of rows) availableFacilities.add(facility.id);
  }
  if (issueIds.size > 0) {
    const { rows } = await database.sql<Selected<
      "issues", "id" | "category" | "status" | "author_uid" | "read_access" | "author_visible"
    >>`select id, category, status, author_uid, read_access, author_visible
       from app_private.issues where id = any(${[...issueIds]})`;
    for (const issue of rows) issues.set(issue.id, issue as unknown as JsonRecord);
  }
  return new Map(uploads.map((upload) => {
    const targetType = asString(upload.attached_target_type);
    const targetId = asString(upload.attached_target_id);
    if (!targetType || !targetId) {
      return [asString(upload.id), { allowed: asString(upload.owner_uid) === auth.uid, privateDelivery: true }];
    }
    if (targetType === "issue") {
      return [asString(upload.id), issueDeliveryAccess(issues.get(targetId), auth)];
    }
    if (targetType === "comment") {
      return [asString(upload.id), issueDeliveryAccess(issues.get(commentToIssue.get(targetId) ?? ""), auth)];
    }
    if (targetType === "announcement" || targetType === "announcement_comment") {
      return [asString(upload.id), { allowed: true, privateDelivery: false }];
    }
    if (targetType === "facility") {
      return [asString(upload.id), { allowed: availableFacilities.has(targetId), privateDelivery: false }];
    }
    return [asString(upload.id), { allowed: false, privateDelivery: true }];
  }));
}

export async function resolveUploadImageUrls(
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
): Promise<JsonRecord> {
  const uploadIds = Array.isArray(payload.uploadIds) ? payload.uploadIds.map((id) => asString(id)).filter(Boolean).slice(0, 50) : [];
  const { rows: deliverable } = await database.sql<Selected<
    "uploads", "id" | "owner_uid" | "cloudinary_public_id" | "attached_target_type" | "attached_target_id"
  >>`select id, owner_uid, cloudinary_public_id, attached_target_type, attached_target_id
     from app_private.uploads
     where id = any(${uploadIds}) and status = any(${["ready", "attached"]})`;
  const accessByUploadId = await resolveUploadAccessBatch(deliverable as unknown as JsonRecord[], auth, database);
  const resolved = await Promise.all(deliverable.map(async (upload) => {
    const access = accessByUploadId.get(upload.id) ?? { allowed: false, privateDelivery: true };
    if (!access.allowed || !upload.cloudinary_public_id) return null;
    return {
      id: upload.id,
      ...await createMediaDeliveryUrls(upload.cloudinary_public_id, access.privateDelivery, auth.uid),
    };
  }));
  const available = resolved.filter((entry: any): entry is NonNullable<typeof entry> => Boolean(entry));
  const expiresAtMs = available.length
    ? Math.min(...available.map((entry: any) => entry.expiresAtMs))
    : Date.now();
  return {
    errors: Object.fromEntries(uploadIds.filter((id) => !available.some((entry: any) => entry.id === id)).map((id) => [id, "not-found"])),
    expiresAt: new Date(expiresAtMs).toISOString(),
    expiresAtByUploadId: Object.fromEntries(available.map((entry: any) => [entry.id, new Date(entry.expiresAtMs).toISOString()])),
    fullUrls: Object.fromEntries(available.map((entry: any) => [entry.id, entry.fullUrl])),
    thumbnailUrls: Object.fromEntries(available.map((entry: any) => [entry.id, entry.thumbnailUrl])),
  };
}
