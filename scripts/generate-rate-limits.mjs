import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function assertPositiveInteger(value, errorMsg) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(errorMsg);
  }
  return value;
}

function assertNonEmptyString(value, errorMsg) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(errorMsg);
  }
  return value;
}

function assertNumberRange(value, min, max, errorMsg) {
  if (typeof value !== 'number' || value < min || value > max) {
    throw new Error(errorMsg);
  }
  return value;
}

async function readRateLimitsConfig(projectRoot) {
  const configPath = path.join(projectRoot, 'config', 'rate-limits.config.json');
  const raw = JSON.parse(await readFile(configPath, 'utf8'));

  const issueCreateDaily = raw.issueCreateDaily || {};
  const commentCreateHourly = raw.commentCreateHourly || {};
  const imageUploadDaily = raw.imageUploadDaily || {};
  const imageUploadWriteSecond = raw.imageUploadWriteSecond || {};
  const imageUploadWriteHourly = raw.imageUploadWriteHourly || {};
  const loginSyncHourly = raw.loginSyncHourly || {};
  const avatarCacheDaily = raw.avatarCacheDaily || {};
  const supportToggleHourly = raw.supportToggleHourly || {};
  const announcementLikeHourly = raw.announcementLikeHourly || {};
  const pushTokenWriteHourly = raw.pushTokenWriteHourly || {};
  const backendActionReadHourly = raw.backendActionReadHourly || {};
  const backendActionReadSecond = raw.backendActionReadSecond || {};
  const backendActionWriteHourly = raw.backendActionWriteHourly || {};
  const backendActionWriteSecond = raw.backendActionWriteSecond || {};
  const backendActionSensitiveWriteHourly = raw.backendActionSensitiveWriteHourly || {};
  const backendActionSensitiveWriteSecond = raw.backendActionSensitiveWriteSecond || {};
  const backendActionAdminWriteHourly = raw.backendActionAdminWriteHourly || {};
  const backendActionAdminWriteSecond = raw.backendActionAdminWriteSecond || {};
  const backendActionUploadResolveHourly = raw.backendActionUploadResolveHourly || {};
  const backendActionUploadResolveSecond = raw.backendActionUploadResolveSecond || {};
  const backendHealthcheckMinute = raw.backendHealthcheckMinute || {};
  const backendHealthcheckSecond = raw.backendHealthcheckSecond || {};
  const cloudinaryWebhookMinute = raw.cloudinaryWebhookMinute || {};
  const cloudinaryWebhookSecond = raw.cloudinaryWebhookSecond || {};
  const workerRunMinute = raw.workerRunMinute || {};
  const workerRunSecond = raw.workerRunSecond || {};
  const imageUploads = raw.imageUploads || {};
  const imageCompression = raw.imageCompression || {};

  function readLimitConfig(name, value) {
    return {
      limit: assertPositiveInteger(value.limit, `${name}.limit 必須是正整數。`),
      message: assertNonEmptyString(value.message, `${name}.message 必須是非空字串。`),
    };
  }

  const limits = {
    issueCreateDaily: readLimitConfig('issueCreateDaily', issueCreateDaily),
    commentCreateHourly: readLimitConfig('commentCreateHourly', commentCreateHourly),
    imageUploadDaily: readLimitConfig('imageUploadDaily', imageUploadDaily),
    imageUploadWriteSecond: readLimitConfig('imageUploadWriteSecond', imageUploadWriteSecond),
    imageUploadWriteHourly: readLimitConfig('imageUploadWriteHourly', imageUploadWriteHourly),
    loginSyncHourly: readLimitConfig('loginSyncHourly', loginSyncHourly),
    avatarCacheDaily: readLimitConfig('avatarCacheDaily', avatarCacheDaily),
    supportToggleHourly: readLimitConfig('supportToggleHourly', supportToggleHourly),
    announcementLikeHourly: readLimitConfig('announcementLikeHourly', announcementLikeHourly),
    pushTokenWriteHourly: readLimitConfig('pushTokenWriteHourly', pushTokenWriteHourly),
    backendActionReadHourly: readLimitConfig('backendActionReadHourly', backendActionReadHourly),
    backendActionReadSecond: readLimitConfig('backendActionReadSecond', backendActionReadSecond),
    backendActionWriteHourly: readLimitConfig('backendActionWriteHourly', backendActionWriteHourly),
    backendActionWriteSecond: readLimitConfig('backendActionWriteSecond', backendActionWriteSecond),
    backendActionSensitiveWriteHourly: readLimitConfig('backendActionSensitiveWriteHourly', backendActionSensitiveWriteHourly),
    backendActionSensitiveWriteSecond: readLimitConfig('backendActionSensitiveWriteSecond', backendActionSensitiveWriteSecond),
    backendActionAdminWriteHourly: readLimitConfig('backendActionAdminWriteHourly', backendActionAdminWriteHourly),
    backendActionAdminWriteSecond: readLimitConfig('backendActionAdminWriteSecond', backendActionAdminWriteSecond),
    backendActionUploadResolveHourly: readLimitConfig('backendActionUploadResolveHourly', backendActionUploadResolveHourly),
    backendActionUploadResolveSecond: readLimitConfig('backendActionUploadResolveSecond', backendActionUploadResolveSecond),
    backendHealthcheckMinute: readLimitConfig('backendHealthcheckMinute', backendHealthcheckMinute),
    backendHealthcheckSecond: readLimitConfig('backendHealthcheckSecond', backendHealthcheckSecond),
    cloudinaryWebhookMinute: readLimitConfig('cloudinaryWebhookMinute', cloudinaryWebhookMinute),
    cloudinaryWebhookSecond: readLimitConfig('cloudinaryWebhookSecond', cloudinaryWebhookSecond),
    workerRunMinute: readLimitConfig('workerRunMinute', workerRunMinute),
    workerRunSecond: readLimitConfig('workerRunSecond', workerRunSecond),
    imageUploads: {
      issueMaxImages: assertPositiveInteger(imageUploads.issueMaxImages, 'imageUploads.issueMaxImages 必須是正整數。'),
      announcementMaxImages: assertPositiveInteger(imageUploads.announcementMaxImages, 'imageUploads.announcementMaxImages 必須是正整數。'),
      commentMaxImages: assertPositiveInteger(imageUploads.commentMaxImages, 'imageUploads.commentMaxImages 必須是正整數。'),
    },
    imageCompression: {
      maxUploadKilobytes: assertPositiveInteger(imageCompression.maxUploadKilobytes, 'imageCompression.maxUploadKilobytes 必須是正整數。'),
      maxUploadBytes: assertPositiveInteger(imageCompression.maxUploadKilobytes, '') * 1024,
      maxSourceMegabytes: assertPositiveInteger(imageCompression.maxSourceMegabytes, 'imageCompression.maxSourceMegabytes 必須是正整數。'),
      maxSourceBytes: assertPositiveInteger(imageCompression.maxSourceMegabytes, '') * 1024 * 1024,
      maxDimension: assertPositiveInteger(imageCompression.maxDimension, 'imageCompression.maxDimension 必須是正整數。'),
      maxPixels: assertPositiveInteger(imageCompression.maxPixels, 'imageCompression.maxPixels 必須是正整數。'),
      webpQuality: assertNumberRange(imageCompression.webpQuality, 0.01, 1.0, 'imageCompression.webpQuality 必須在 0.01 與 1.0 之間。'),
      outputScales: Array.isArray(imageCompression.outputScales)
        ? imageCompression.outputScales.map((scale, i) => assertNumberRange(scale, 0.01, 1.0, `imageCompression.outputScales[${i}] 必須在 0.01 與 1.0 之間。`))
        : [],
    },
  };

  if (limits.imageCompression.outputScales.length === 0) {
    throw new Error('imageCompression.outputScales 必須包含至少一個比例項目。');
  }

  return limits;
}

function renderRateLimitsTs(limits) {
  return `// This file is generated automatically by scripts/generate-rate-limits.mjs.
// Do not edit this file manually.

export const RATE_LIMITS = ${JSON.stringify(limits, null, 2)} as const;

export type RateLimits = typeof RATE_LIMITS;
`;
}

try {
  const config = await readRateLimitsConfig(projectRoot);
  const rendered = renderRateLimitsTs(config);

  const outputPaths = [
    path.join(projectRoot, 'src', 'generated', 'rate-limits.ts'),
    path.join(projectRoot, 'supabase', 'functions', '_shared', 'rate-limits.ts'),
  ];

  await Promise.all(outputPaths.map(async (outputPath) => {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, rendered, 'utf8');
  }));

  console.info('Generated rate limits and image compression configuration.');
} catch (error) {
  console.error('Failed to generate rate limits config:', error.message);
  process.exit(1);
}
