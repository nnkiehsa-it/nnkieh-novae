import type { ActionInput } from "../../../../shared/actions.ts";
import { loadImageUploadSettings } from "../shared/platform-settings.ts";
import { loadImageLimit } from "./upload-policy.ts";
import type { AuthContext, BackendDatabase } from "./types.ts";
import { createUploadSessions, deleteUploadSessions, finalizeUploadSessions } from "./upload-sessions.ts";

export { resolveUploadImageUrls } from "./upload-delivery.ts";

/** A batch may hold no more images than the content it is going on allows. */
async function assertWithinImageLimit(
  input: { targetType: ActionInput<"createImageUploadSessions">["targetType"]; scopeId: string },
  count: number,
  database: BackendDatabase,
) {
  if (count > await loadImageLimit(database, input.targetType, input.scopeId)) throw new Error("validation-too-many");
}

export async function createImageUploadSessions(input: ActionInput<"createImageUploadSessions">, auth: AuthContext, database: BackendDatabase) {
  await assertWithinImageLimit(input, input.images.length, database);
  const settings = await loadImageUploadSettings(database);
  return { sessions: await createUploadSessions(input.images, auth, database, settings) };
}

export async function finalizeImageUploads(input: ActionInput<"finalizeImageUploads">, auth: AuthContext, database: BackendDatabase) {
  await assertWithinImageLimit(input, input.uploads.length, database);
  const settings = await loadImageUploadSettings(database);
  return { uploads: await finalizeUploadSessions(input.uploads, auth, database, settings) };
}

export async function deleteUploadedImages(input: ActionInput<"deleteUploadedImages">, auth: AuthContext, database: BackendDatabase) {
  return await deleteUploadSessions([...new Set(input.storagePaths)], auth, database);
}
