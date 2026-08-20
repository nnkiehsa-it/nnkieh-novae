import type { BusinessRateLimiter } from "./durable/business-rate-limiter";
import type { RealtimeHub } from "./durable/realtime-hub";
import type { JobMessage } from "./backend/jobs/consumer";

export interface Env {
  ADMIN_EMAILS: string;
  ADMIN_WRITE_RATE_LIMITER: RateLimitBinding;
  ALLOWED_DOMAIN: string;
  ALLOWED_ORIGINS: string;
  BUSINESS_RATE_LIMITS: DurableObjectNamespace<BusinessRateLimiter>;
  CLOUDINARY_API_BASE_URL?: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_DELIVERY_BASE_URL?: string;
  DATABASE_URL?: string;
  FCM_EMULATOR_URL?: string;
  FIREBASE_AUTH_EMULATOR_HOST?: string;
  FIREBASE_APP_IDS: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PROJECT_NUMBER: string;
  FIREBASE_WEB_API_KEY: string;
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  HEALTHCHECK_SECRET: string;
  HYPERDRIVE?: { connectionString: string };
  INVALID_AUTH_IP_RATE_LIMITER: RateLimitBinding;
  JOBS: Queue<JobMessage>;
  LOGIN_IP_RATE_LIMITER: RateLimitBinding;
  LOCAL_TEST_MODE?: string;
  MEDIA_INVALID_IP_RATE_LIMITER: RateLimitBinding;
  MEDIA_SIGNING_SECRET: string;
  MEDIA_USER_RATE_LIMITER: RateLimitBinding;
  NOTION_DATABASE_ID?: string;
  NOTION_DATA_SOURCE_ID?: string;
  NOTION_ENABLED?: string;
  NOTION_TOKEN?: string;
  PUBLIC_API_URL: string;
  READ_RATE_LIMITER: RateLimitBinding;
  REALTIME: DurableObjectNamespace<RealtimeHub>;
  REALTIME_TICKET_SECRET: string;
  SENSITIVE_WRITE_RATE_LIMITER: RateLimitBinding;
  SYNC_USER_RATE_LIMITER: RateLimitBinding;
  TURNSTILE_SECRET_KEY: string;
  UPLOAD_RESOLVE_RATE_LIMITER: RateLimitBinding;
  UPLOAD_WRITE_RATE_LIMITER: RateLimitBinding;
  WEBHOOK_GLOBAL_RATE_LIMITER: RateLimitBinding;
  WEBHOOK_IP_RATE_LIMITER: RateLimitBinding;
  WRITE_RATE_LIMITER: RateLimitBinding;
}

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface JsonRecord {
  [key: string]: unknown;
}
