import { invokeBackendAction } from '@/services/backend-action';
import type { CategoryCatalog } from '@/types/categories';
import { RATE_LIMITS } from '@/generated/rate-limits';
import type { SessionAccess } from '@/services/session-role';
import {
  CONTENT_SHORT_CACHE_TTL_MS,
  getCachedContentPersistent,
  markContentCachePrefixStale,
  runCoalescedContentRequest,
  setCachedContent,
  setCachedContentFromRead,
} from '@/services/content-read-cache';

export type ContentVersionDomain = 'announcements' | 'facilities' | 'issues';
export type ContentVersions = Record<ContentVersionDomain, number>;

export interface SessionBootstrapResult {
  access: SessionAccess;
  catalog: CategoryCatalog;
  notificationUnread: { hasUnread: boolean };
  versions: ContentVersions;
  visitRecorded: boolean;
}

const SESSION_BOOTSTRAP_CACHE_KEY = 'session-bootstrap-v1';
let pendingRecordVisit = false;

export function markSessionBootstrapStale() {
  markContentCachePrefixStale(SESSION_BOOTSTRAP_CACHE_KEY);
}

export async function fetchSessionBootstrap(options: {
  force?: boolean;
  recordVisit?: boolean;
} = {}): Promise<SessionBootstrapResult> {
  const force = options.force === true;
  const recordVisit = options.recordVisit === true;
  if (force) markSessionBootstrapStale();
  if (recordVisit) pendingRecordVisit = true;

  // Visit recording is a side effect; never serve a cached response when a visit
  // must be written. Concurrent cold-start callers still share one in-flight request.
  if (!force && !pendingRecordVisit) {
    const cached = await getCachedContentPersistent<SessionBootstrapResult>(
      SESSION_BOOTSTRAP_CACHE_KEY,
      CONTENT_SHORT_CACHE_TTL_MS,
    );
    if (cached?.access?.setupCompleted) return cached;
  }

  return runCoalescedContentRequest(SESSION_BOOTSTRAP_CACHE_KEY, async (cacheGuard) => {
    const shouldRecordVisit = pendingRecordVisit;
    pendingRecordVisit = false;
    const result = await invokeBackendAction<
      { recordVisit?: boolean },
      SessionBootstrapResult
    >('getSessionBootstrap')({
      ...(shouldRecordVisit ? { recordVisit: true } : {}),
    });
    const normalized: SessionBootstrapResult = {
      access: {
        role: result.access?.role === 'admin' ? 'admin' : 'user',
        roles: Array.isArray(result.access?.roles) ? result.access.roles : [],
        permissions: Array.isArray(result.access?.permissions) ? result.access.permissions : [],
        managedIssueCategoryIds: Array.isArray(result.access?.managedIssueCategoryIds)
          ? result.access.managedIssueCategoryIds
          : [],
        managedFacilityCategoryIds: Array.isArray(result.access?.managedFacilityCategoryIds)
          ? result.access.managedFacilityCategoryIds
          : [],
        setupCompleted: result.access?.setupCompleted === true,
      },
      catalog: {
        features: {
          announcementCommentsEnabled: result.catalog?.features?.announcementCommentsEnabled !== false,
          facilitiesEnabled: result.catalog?.features?.facilitiesEnabled !== false,
          issuesEnabled: result.catalog?.features?.issuesEnabled !== false,
        },
        imageUploads: result.catalog?.imageUploads ?? {
          announcementMaxImages: RATE_LIMITS.imageUploads.announcementMaxImages,
          commentMaxImages: RATE_LIMITS.imageUploads.commentMaxImages,
          facilityMaxImages: RATE_LIMITS.imageUploads.facilityMaxImages,
          issueMaxImages: RATE_LIMITS.imageUploads.issueMaxImages,
          maxDimension: RATE_LIMITS.imageCompression.maxDimension,
          maxSourceMegabytes: RATE_LIMITS.imageCompression.maxSourceMegabytes,
          maxUploadKilobytes: RATE_LIMITS.imageCompression.maxUploadKilobytes,
          webpQuality: RATE_LIMITS.imageCompression.webpQuality,
        },
        issueCategories: Array.isArray(result.catalog?.issueCategories)
          ? result.catalog.issueCategories
          : [],
        facilityCategories: Array.isArray(result.catalog?.facilityCategories)
          ? result.catalog.facilityCategories
          : [],
        setupCompleted: result.catalog?.setupCompleted === true
          || result.access?.setupCompleted === true,
      },
      notificationUnread: {
        hasUnread: result.notificationUnread?.hasUnread === true,
      },
      versions: {
        announcements: Number(result.versions?.announcements ?? 1),
        facilities: Number(result.versions?.facilities ?? 1),
        issues: Number(result.versions?.issues ?? 1),
      },
      visitRecorded: result.visitRecorded === true,
    };
    if (!shouldRecordVisit) setCachedContentFromRead(cacheGuard, { ...normalized, visitRecorded: false });
    else setCachedContent(SESSION_BOOTSTRAP_CACHE_KEY, { ...normalized, visitRecorded: false });
    return normalized;
  });
}
