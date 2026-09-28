import { asRecord, asString } from "../shared/http.ts";
import { loadImageUploadSettings, maxImagesForTarget, type UploadTargetType } from "../shared/platform-settings.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { resolveUploadImageUrls } from "./upload-delivery.ts";
import { createUploadSessions, deleteUploadSessions, finalizeUploadSessions } from "./upload-sessions.ts";

function uploadTargetType(value: unknown): UploadTargetType {
  if (value === "issue" || value === "facility" || value === "announcement" || value === "comment" || value === "announcement_comment") return value;
  throw new Error("validation-required");
}

export async function handleUploadAction(action: string, payload: JsonRecord, auth: AuthContext, database: BackendDatabase): Promise<JsonRecord> {
  if (action === "resolveUploadImageUrls") return resolveUploadImageUrls(payload, auth, database);
  if (action === "deleteUploadedImages") {
    const paths = Array.isArray(payload.storagePaths)
      ? [...new Set(payload.storagePaths.map((path) => asString(path)).filter(Boolean))].slice(0, 50)
      : [];
    return deleteUploadSessions(paths, auth, database);
  }
  if (action !== "createImageUploadSessions" && action !== "finalizeImageUploads") throw new Error("invalid-action");
  const targetType = uploadTargetType(payload.targetType);
  const settings = await loadImageUploadSettings(database);
  const input = action === "createImageUploadSessions" ? payload.images : payload.uploads;
  const items = Array.isArray(input) ? input.map(asRecord) : [];
  if (items.length === 0) throw new Error("validation-required");
  if (items.length > maxImagesForTarget(settings, targetType)) throw new Error("validation-too-many");
  return action === "createImageUploadSessions"
    ? { sessions: await createUploadSessions(items, auth, database, settings) }
    : { uploads: await finalizeUploadSessions(items, auth, database, settings) };
}
