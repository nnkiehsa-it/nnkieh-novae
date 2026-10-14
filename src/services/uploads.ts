import * as v from 'valibot';
import type { ImageUploadSession, ImageUploadTargetType, UploadedImage } from '@shared/contracts/uploads.ts';
import { callAction } from '@/services/backend-action';
import { longRequestTimeoutMs, withRequestTimeout } from '@/lib/request';
import { toReadableBackendError } from './backend-errors';
import { t } from '@/i18n';

export { clearResolvedUploadCache, resolveUploadImageUrls } from './upload-delivery';

/** What Cloudinary answers for a stored image: the id, version and signature the Worker verifies. */
const CloudinaryUploadResponse = v.object({ public_id: v.string(), signature: v.string(), version: v.number() });

interface CloudinaryErrorResponse {
  error?: {
    message?: string;
  };
}

interface ImageUploadInput {
  file: File;
  height: number;
  width: number;
}

export type { ImageUploadTargetType } from '@shared/contracts/uploads.ts';

function toReadableUploadError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const uploadMessage = message.replace(/^FirebaseError:\s*/u, '').trim();

  if (uploadMessage && /\u5716\u7247|WebP|JPEG|UPLOAD-/u.test(uploadMessage)) {
    return new Error(uploadMessage);
  }

  return toReadableBackendError(error);
}

async function createCloudinaryUploadError(response: Response) {
  let providerMessage = '';
  try {
    const payload = await response.json() as CloudinaryErrorResponse;
    providerMessage = payload.error?.message?.trim() ?? '';
  } catch {
    // Cloudinary 偶爾會回傳非 JSON 錯誤頁；只依狀態碼提供安全訊息。
  }

  if (response.status === 401) {
    if (/stale|expired|timestamp.{0,40}(?:too old|out of range)|(?:too old|out of range).{0,40}timestamp/i.test(providerMessage)) {
      return new Error('image.uploadVerificationTimeout');
    }
    return new Error('access.imageServiceMisconfigured');
  }
  if (response.status === 413 || /file size|too large/i.test(providerMessage)) {
    return new Error('image.imageSizeExceedsUploadLimit');
  }
  if (response.status === 400 && /format|allowed_formats/i.test(providerMessage)) {
    return new Error('image.unsupportedFormat');
  }
  return new Error(t('upload.httpFailed', { status: response.status }));
}

async function uploadToCloudinary(file: File, session: ImageUploadSession) {
  const body = new FormData();
  body.set('file', file);
  body.set('api_key', session.apiKey);
  body.set('timestamp', String(session.timestamp));
  body.set('public_id', session.publicId);
  body.set('signature', session.signature);
  body.set('allowed_formats', session.allowedFormats);
  body.set('folder', session.folder);
  body.set('max_file_size', session.maxFileSize);
  body.set('overwrite', session.overwrite);
  body.set('notification_url', session.notificationUrl);
  body.set('type', session.type);
  body.set('upload_preset', session.uploadPreset);

  return await withRequestTimeout(async (signal) => {
    const response = await fetch(
      session.uploadUrl,
      { method: 'POST', body, signal },
    );
    if (!response.ok) throw await createCloudinaryUploadError(response);
    const answer = v.safeParse(CloudinaryUploadResponse, await response.json());
    if (!answer.success) throw new Error('upstream-invalid-response');
    return answer.output;
  }, { label: 'request.imageUpload', timeoutMs: longRequestTimeoutMs });
}

export async function createImageUploadPolicies(
  inputs: ImageUploadInput[],
  targetType: ImageUploadTargetType,
  scopeId: string,
): Promise<UploadedImage[]> {
  if (inputs.length === 0) return [];
  if (inputs.some(({ file }) => file.type !== 'image/webp')) {
    throw new Error('image.imagesMustBeConvertedToWebpBeforeUploading');
  }

  let sessions: ImageUploadSession[] = [];
  try {
    const created = await callAction('createImageUploadSessions', {
      images: inputs.map(({ file, height, width }) => ({
        contentType: 'image/webp' as const,
        height,
        size: file.size,
        width,
      })),
      targetType,
      scopeId,
    });
    sessions = created.sessions;
    const results = await Promise.allSettled(
      inputs.map(({ file }, index) => uploadToCloudinary(file, sessions[index]!)),
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
    const uploadResponses = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);

    const result = await callAction('finalizeImageUploads', {
      targetType,
      scopeId,
      uploads: uploadResponses.map((response, index) => ({
        publicId: response.public_id,
        signature: response.signature,
        uploadId: sessions[index]!.uploadId,
        version: response.version,
      })),
    }, { timeoutMs: longRequestTimeoutMs });
    return result.uploads;
  } catch (error) {
    // Wait for the batch to settle before scheduling deletion, so slower files cannot recreate cleaned-up assets.
    await deleteUploadedImages(sessions.map((session) => `${session.folder}/${session.publicId}`)).catch(() => undefined);
    throw toReadableUploadError(error);
  }
}

export async function deleteUploadedImages(storagePaths: string[]) {
  const uniquePaths = [...new Set(storagePaths.filter(Boolean))];
  if (uniquePaths.length === 0) return;
  try {
    await callAction('deleteUploadedImages', { storagePaths: uniquePaths });
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

