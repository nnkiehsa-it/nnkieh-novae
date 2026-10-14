import type { ApiErrorCode } from "./api-errors.ts";

export type RateLimitWindow = "second" | "minute" | "hour" | "taipei-day";

/**
 * Business limits, each a fixed-window counter: the error it answers with, the
 * name its count is kept under, and the window that count resets on. The limit
 * itself is a runtime policy of the same name; this value is its default.
 */
export const RATE_LIMITS = {
  issueCreateDaily: { limit: 10, errorCode: "rate-limit.issue-create", counter: "issue.create", window: "taipei-day" },
  facilityCreateDaily: { limit: 10, errorCode: "rate-limit.facility-create", counter: "facility.create", window: "taipei-day" },
  announcementCreateDaily: { limit: 20, errorCode: "rate-limit.admin-operation", counter: "announcement.create", window: "taipei-day" },
  commentCreateHourly: { limit: 60, errorCode: "rate-limit.comment-create", counter: "comment.create", window: "hour" },
  imageUploadDaily: { limit: 50, errorCode: "rate-limit.image-upload-daily", counter: "image-upload.create", window: "taipei-day" },
  loginSyncHourly: { limit: 20, errorCode: "rate-limit.login-sync", counter: "auth.sync", window: "hour" },
  avatarCacheDaily: { limit: 30, errorCode: "rate-limit.avatar-update", counter: "avatar.cache", window: "taipei-day" },
  supportToggleHourly: { limit: 120, errorCode: "rate-limit.support", counter: "support.toggle", window: "hour" },
  facilityAffectedToggleHourly: { limit: 120, errorCode: "rate-limit.facility-affected", counter: "facility.affected", window: "hour" },
  facilityStatusUpdateHourly: { limit: 60, errorCode: "rate-limit.facility-status", counter: "facility.status", window: "hour" },
  announcementLikeHourly: { limit: 120, errorCode: "rate-limit.announcement-interaction", counter: "announcement.like", window: "hour" },
  pushTokenWriteHourly: { limit: 30, errorCode: "rate-limit.push-token", counter: "push-token.write", window: "hour" },
  preferenceWriteHourly: { limit: 60, errorCode: "rate-limit.operation", counter: "preference.write", window: "hour" },
  moderationWriteHourly: { limit: 120, errorCode: "rate-limit.admin-operation", counter: "content.moderate", window: "hour" },
  roleWriteHourly: { limit: 120, errorCode: "rate-limit.admin-operation", counter: "role.write", window: "hour" },
  destructiveWriteHourly: { limit: 30, errorCode: "rate-limit.operation", counter: "content.delete", window: "hour" },
  backendHealthcheckMinute: { limit: 12, errorCode: "rate-limit.healthcheck", counter: "backend.healthcheck", window: "minute" },
  backendHealthcheckSecond: { limit: 2, errorCode: "rate-limit.healthcheck", counter: "backend.healthcheck.second", window: "second" },
  workerRunMinute: { limit: 30, errorCode: "rate-limit.background-processing", counter: "worker.minute", window: "minute" },
  workerRunSecond: { limit: 2, errorCode: "rate-limit.background-processing", counter: "worker.second", window: "second" },
} as const satisfies Record<string, { limit: number; errorCode: ApiErrorCode; counter: string; window: RateLimitWindow }>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** How many images one piece of content may carry. */
export const IMAGE_UPLOAD_LIMITS = { issueMaxImages: 2, facilityMaxImages: 2, announcementMaxImages: 10, commentMaxImages: 1 } as const;

const MAX_UPLOAD_KILOBYTES = 800;

/** How the browser shrinks an image before it is uploaded. */
export const IMAGE_COMPRESSION = {
  maxUploadKilobytes: MAX_UPLOAD_KILOBYTES,
  maxUploadBytes: MAX_UPLOAD_KILOBYTES * 1024,
  maxPlatformUploadKilobytes: 5000,
  maxDimension: 2000,
  webpQuality: 0.82,
  outputScales: [1, 0.7, 0.5, 0.4],
} as const;
