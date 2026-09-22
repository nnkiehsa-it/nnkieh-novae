import assert from "node:assert/strict";
import { asRecord, callAction, database, insertRows, integrationTest, seedActor } from "./helpers.ts";

integrationTest("public image resolution works and direct cleanup cannot delete attached images", async () => {
  const author = await seedActor("upload-author");
  const uploadId = crypto.randomUUID();
  const publicId = `srp/${author.auth.uid}/${uploadId}`;
  await insertRows("uploads", [{ id: uploadId, owner_uid: author.auth.uid, cloudinary_public_id: publicId, status: "ready", visibility: "authenticated", width: 10, height: 10, size_bytes: 100, content_type: "image/webp" }]);
  const issue = asRecord(asRecord(await callAction("createIssue", { title: "Attached image", content: `![image](srp-upload://${uploadId})`, category: "proposal-a" }, author.auth)).issue);
  const resolved = asRecord(await callAction("resolveUploadImageUrls", { uploadIds: [uploadId] }, author.auth));
  assert.ok(Number.isFinite(Date.parse(String(resolved.expiresAt))));
  assert.ok(asRecord(resolved.fullUrls)[uploadId]);
  const deleted = asRecord(await callAction("deleteUploadedImages", { storagePaths: [publicId] }, author.auth));
  assert.equal(deleted.deleted, 0);
  const attached = await database.sqlOne<{attached_target_id:string}>`select attached_target_id from app_private.uploads where id=${uploadId}`;
  assert.equal(attached.attached_target_id, issue.id);
  const unusedId = crypto.randomUUID();
  await insertRows("uploads", [{ id: unusedId, owner_uid: author.auth.uid, cloudinary_public_id: `srp/${unusedId}`, status: "ready", visibility: "authenticated" }]);
  assert.equal(asRecord(await callAction("deleteUploadedImages", { storagePaths: [`srp/${unusedId}`] }, author.auth)).deleted, 1);
});
