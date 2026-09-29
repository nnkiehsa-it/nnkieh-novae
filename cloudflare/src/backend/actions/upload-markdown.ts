import type { UploadTargetType } from "../shared/platform-settings.ts";
import { loadImageLimit } from "./upload-policy.ts";
import type { Selected } from "../database/schema.ts";
import type { BackendDatabase } from "./types.ts";

const UPLOAD_ID = /srp-upload:\/\/([0-9a-fA-F-]{36})/gu;
const IMAGE_SOURCE = /!\[[^\]]*\]\((\S+?)(?:\s+["'][^"']*["'])?\)/gu;

async function validateMarkdownUploads(
  database: BackendDatabase,
  ownerUid: string,
  content: string,
  targetType: UploadTargetType,
  targetId: string | null,
  scopeId: string,
) {
  const sources = [...content.matchAll(IMAGE_SOURCE)].map((match) => match[1]);
  if (sources.some((source) => !source?.startsWith("srp-upload://"))) throw new Error("validation-invalid");
  const uploadIds = [...new Set([...content.matchAll(UPLOAD_ID)].map((match) => match[1]).filter(Boolean))];
  if (uploadIds.length === 0) return;
  const maxImages = await loadImageLimit(database, targetType, scopeId);
  if (Math.max(sources.length, uploadIds.length) > maxImages) throw new Error("validation-too-many");

  const { rows } = await database.sql<Selected<
    "uploads", "id" | "owner_uid" | "status" | "attached_target_type" | "attached_target_id"
  >>`select id, owner_uid, status, attached_target_type, attached_target_id
     from app_private.uploads where id = any(${uploadIds}) order by id for update`;
  const validIds = new Set(rows.filter((upload) =>
    (upload.status === "ready" || upload.status === "attached")
    && (targetId
      ? (upload.attached_target_type === targetType && upload.attached_target_id === targetId)
        || (upload.owner_uid === ownerUid && !upload.attached_target_id)
      : upload.owner_uid === ownerUid && !upload.attached_target_id)
  ).map((upload) => upload.id));
  if (validIds.size !== uploadIds.length) throw new Error("validation-invalid");
}

export function validateMarkdownUploadsBeforeCreate(
  database: BackendDatabase, ownerUid: string, content: string, targetType: UploadTargetType, scopeId = "",
) {
  return validateMarkdownUploads(database, ownerUid, content, targetType, null, scopeId);
}

export function validateMarkdownUploadsBeforeUpdate(
  database: BackendDatabase, ownerUid: string, content: string, targetType: UploadTargetType, targetId: string, scopeId: string,
) {
  return validateMarkdownUploads(database, ownerUid, content, targetType, targetId, scopeId);
}
