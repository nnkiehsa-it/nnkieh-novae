import { contentRouteTarget } from '@/lib/content-route';
import { fetchAnnouncementRecordById } from '@/services/announcements';
import { getFacility } from '@/services/facilities';
import { fetchIssueRecordById } from '@/services/issues';

/**
 * Fetch the record a detail route shows before anyone has gone there.
 *
 * Every one of these reads is cached and coalesced, so warming a record costs
 * one request that the page then does not have to make: by the time the route
 * commits the record is already in memory, and the detail opens on content
 * instead of on a skeleton that resolves a moment later. A warm-up that fails
 * is not an error anyone can act on — the page will ask again and report it
 * properly — so it is dropped here.
 */
export async function preloadContentRoute(pathname: string, cacheScope: string | undefined) {
  const target = contentRouteTarget(pathname);
  if (!target) return;
  try {
    if (target.domain === 'issue') await fetchIssueRecordById(target.id, { cacheScope });
    if (target.domain === 'facility') await getFacility(target.id);
    if (target.domain === 'announcement')
      await fetchAnnouncementRecordById(target.id, { cacheScope });
  } catch {
    return;
  }
}
