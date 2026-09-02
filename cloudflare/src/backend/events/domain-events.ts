import type { Json } from "../database/schema.ts";
import type { JsonRecord } from "../actions/types.ts";

export type EventDestination = "notion" | "in_app" | "push" | "realtime";

export const DOMAIN_EVENT_TYPES = [
  "issue.created", "issue.status_changed", "issue.result_updated", "issue.deleted",
  "support.goal_met", "support.toggled", "issue.comment_created", "issue.comment_deleted",
  "facility.created", "facility.status_changed", "facility.deleted", "facility.affected_toggled",
  "announcement.created", "announcement.updated", "announcement.deleted", "announcement.liked",
  "announcement.comment_created", "announcement.comment_deleted", "admin.audit_recorded",
  "category.managed", "category.updated", "platform.settings_updated", "system.setup_completed",
  "system.features_updated", "user.restricted", "user.role_changed", "user.access_scoped",
  "user.avatar_updated", "notification.marked_opened", "push_token.updated", "upload.mutated",
  "deletion_job.retried",
] as const;

export type DomainEventType = typeof DOMAIN_EVENT_TYPES[number];

export interface ResolvedDomainEvent {
  aggregateType: string;
  aggregateId: string;
  eventType: DomainEventType;
  destinations: EventDestination[];
  payload: Json;
}

export function resolveDomainEvents(
  action: string,
  payload: JsonRecord,
  result: unknown,
  actorUid: string,
): ResolvedDomainEvent[] {
  const res = (result ?? {}) as JsonRecord;
  const resIssue = (res.issue ?? {}) as JsonRecord;
  const resFacility = (res.facility ?? {}) as JsonRecord;
  const resAnnouncement = (res.announcement ?? {}) as JsonRecord;
  const resComment = (res.comment ?? {}) as JsonRecord;
  const events: ResolvedDomainEvent[] = [];

  switch (action) {
    case "createIssue": {
      const issueId = String(resIssue.id ?? res.id ?? payload.id ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "issue.created",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          issue_id: issueId,
          title: String(resIssue.title ?? res.title ?? payload.title ?? ""),
          category: String(resIssue.category ?? res.category ?? payload.category ?? ""),
          author_uid: actorUid,
          read_access: String(resIssue.readAccess ?? "owner-admin"),
        },
      });
      break;
    }
    case "moderateIssueStatus": {
      const issueId = String(payload.issueId ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "issue.status_changed",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          issue_id: issueId,
          new_status: String(res.status ?? payload.nextStatus ?? ""),
          author_uid: String(res.authorUid ?? ""),
          title: String(res.title ?? ""),
          read_access: String(res.readAccess ?? "owner-admin"),
        },
      });
      break;
    }
    case "updateIssueResult": {
      const issueId = String(payload.issueId ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "issue.result_updated",
        destinations: ["notion", "realtime"],
        payload: {
          issue_id: issueId,
          result_content: String(payload.resultContent ?? ""),
        },
      });
      break;
    }
    case "toggleSupport": {
      const issueId = String(payload.issueId ?? "");
      const goalMet = Boolean(res.goal_met);
      if (goalMet) {
        events.push({
          aggregateType: "issue",
          aggregateId: issueId,
          eventType: "support.goal_met",
          destinations: ["notion", "in_app", "push", "realtime"],
          payload: { issue_id: issueId, supporter_uid: actorUid },
        });
      } else {
        events.push({
          aggregateType: "issue",
          aggregateId: issueId,
          eventType: "support.toggled",
          destinations: ["notion", "realtime"],
          payload: {
            issue_id: issueId,
            supporter_uid: actorUid,
            supported: Boolean(res.supported),
            support_count: Number(res.support_count ?? res.supportCount ?? 0),
          },
        });
      }
      break;
    }
    case "removeSupport": {
      const issueId = String(payload.issueId ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "support.toggled",
        destinations: ["realtime"],
        payload: { issue_id: issueId, supporter_uid: actorUid, supported: false },
      });
      break;
    }
    case "deleteIssue": {
      const issueId = String(payload.issueId ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "issue.deleted",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          issue_id: issueId,
          author_uid: String(res.authorUid ?? ""),
          issue_category: String(res.issueCategory ?? ""),
          supporter_uids: Array.isArray(res.supporterUids) ? res.supporterUids : [],
          title: String(res.title ?? ""),
          read_access: String(res.readAccess ?? "owner-admin"),
        },
      });
      break;
    }
    case "createComment": {
      const commentId = String(resComment.id ?? res.id ?? "");
      const issueId = String(payload.issueId ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "issue.comment_created",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          comment_id: commentId,
          issue_id: issueId,
          parent_comment_id: String(resComment.parent_comment_id ?? resComment.parentCommentId ?? payload.parentCommentId ?? ""),
          content: String(resComment.content ?? payload.content ?? ""),
          author_uid: actorUid,
        },
      });
      break;
    }
    case "deleteComment": {
      const commentId = String(payload.commentId ?? "");
      const issueId = String(payload.issueId ?? "");
      events.push({
        aggregateType: "issue",
        aggregateId: issueId,
        eventType: "issue.comment_deleted",
        destinations: ["notion", "realtime"],
        payload: { comment_id: commentId, issue_id: issueId },
      });
      break;
    }
    case "createFacility": {
      const facilityId = String(resFacility.id ?? res.id ?? "");
      events.push({
        aggregateType: "facility",
        aggregateId: facilityId,
        eventType: "facility.created",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          facility_id: facilityId,
          title: String(resFacility.title ?? res.title ?? payload.title ?? ""),
          author_uid: actorUid,
          category_id: String(resFacility.categoryId ?? resFacility.category_id ?? res.categoryId ?? res.category_id ?? payload.category ?? payload.categoryId ?? ""),
        },
      });
      break;
    }
    case "updateFacilityStatus": {
      const facilityId = String(payload.facilityId ?? "");
      events.push({
        aggregateType: "facility",
        aggregateId: facilityId,
        eventType: "facility.status_changed",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          facility_id: facilityId,
          new_status: String(resFacility.status ?? res.status ?? payload.nextStatus ?? ""),
          author_uid: String(resFacility.authorUid ?? resFacility.author_uid ?? res.authorUid ?? res.author_uid ?? ""),
          title: String(resFacility.title ?? res.title ?? ""),
        },
      });
      break;
    }
    case "toggleFacilityAffected": {
      const facilityId = String(payload.facilityId ?? "");
      events.push({
        aggregateType: "facility",
        aggregateId: facilityId,
        eventType: "facility.affected_toggled",
        destinations: ["realtime"],
        payload: { facility_id: facilityId, actor_uid: actorUid },
      });
      break;
    }
    case "deleteFacility": {
      const facilityId = String(payload.facilityId ?? "");
      events.push({
        aggregateType: "facility",
        aggregateId: facilityId,
        eventType: "facility.deleted",
        destinations: ["notion", "realtime"],
        payload: { facility_id: facilityId },
      });
      break;
    }
    case "createAnnouncement": {
      const announcementId = String(resAnnouncement.id ?? res.id ?? "");
      events.push({
        aggregateType: "announcement",
        aggregateId: announcementId,
        eventType: "announcement.created",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          announcement_id: announcementId,
          title: String(resAnnouncement.title ?? res.title ?? payload.title ?? ""),
          author_uid: actorUid,
        },
      });
      break;
    }
    case "deleteAnnouncement": {
      const announcementId = String(payload.announcementId ?? "");
      events.push({
        aggregateType: "announcement",
        aggregateId: announcementId,
        eventType: "announcement.deleted",
        destinations: ["notion", "realtime"],
        payload: { announcement_id: announcementId },
      });
      break;
    }
    case "setAnnouncementLike": {
      const announcementId = String(payload.announcementId ?? "");
      events.push({
        aggregateType: "announcement",
        aggregateId: announcementId,
        eventType: "announcement.liked",
        destinations: ["realtime"],
        payload: {
          announcement_id: announcementId,
          actor_uid: actorUid,
          liked: Boolean(payload.liked),
          like_count: Number(res.like_count ?? res.likeCount ?? 0),
        },
      });
      break;
    }
    case "createAnnouncementComment": {
      const commentId = String(resComment.id ?? res.id ?? "");
      const announcementId = String(payload.announcementId ?? "");
      events.push({
        aggregateType: "announcement",
        aggregateId: announcementId,
        eventType: "announcement.comment_created",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          comment_id: commentId,
          announcement_id: announcementId,
          parent_comment_id: String(resComment.parent_comment_id ?? resComment.parentCommentId ?? payload.parentCommentId ?? ""),
          content: String(resComment.content ?? payload.content ?? ""),
          author_uid: actorUid,
        },
      });
      break;
    }
    case "deleteAnnouncementComment": {
      const commentId = String(payload.commentId ?? "");
      const announcementId = String(payload.announcementId ?? "");
      events.push({
        aggregateType: "announcement",
        aggregateId: announcementId,
        eventType: "announcement.comment_deleted",
        destinations: ["notion", "realtime"],
        payload: { comment_id: commentId, announcement_id: announcementId },
      });
      break;
    }
    case "markNotificationsOpened": {
      events.push({
        aggregateType: "user",
        aggregateId: actorUid,
        eventType: "notification.marked_opened",
        destinations: ["realtime"],
        payload: { actor_uid: actorUid },
      });
      break;
    }
    case "registerPushToken":
    case "unregisterPushToken":
    case "updatePushNotificationPreferences": {
      events.push({
        aggregateType: "user",
        aggregateId: actorUid,
        eventType: "push_token.updated",
        destinations: [],
        payload: { actor_uid: actorUid, action },
      });
      break;
    }
    case "completeInitialSetup": {
      events.push({
        aggregateType: "system",
        aggregateId: "global",
        eventType: "system.setup_completed",
        destinations: ["notion", "realtime"],
        payload: { actor_uid: actorUid },
      });
      break;
    }
    case "savePlatformFeatures": {
      events.push({
        aggregateType: "system",
        aggregateId: "global",
        eventType: "system.features_updated",
        destinations: ["notion", "realtime"],
        payload: { actor_uid: actorUid },
      });
      break;
    }
    case "saveCategoryManagement": {
      events.push({
        aggregateType: "category",
        aggregateId: "global",
        eventType: "category.managed",
        destinations: ["notion", "realtime"],
        payload: { actor_uid: actorUid },
      });
      break;
    }
    case "savePlatformSettings": {
      events.push({
        aggregateType: "platform",
        aggregateId: "global",
        eventType: "platform.settings_updated",
        destinations: ["notion", "realtime"],
        payload: { actor_uid: actorUid },
      });
      break;
    }
    case "setUserRestriction": {
      const targetUid = String(payload.targetUid ?? payload.uid ?? "");
      events.push({
        aggregateType: "user",
        aggregateId: targetUid,
        eventType: "user.restricted",
        destinations: ["notion", "realtime"],
        payload: { target_uid: targetUid, actor_uid: actorUid },
      });
      break;
    }
    case "setUserAccessScope": {
      const targetUid = String(payload.targetUid ?? payload.uid ?? "");
      events.push({
        aggregateType: "user",
        aggregateId: targetUid,
        eventType: "user.access_scoped",
        destinations: ["notion", "realtime"],
        payload: { target_uid: targetUid, actor_uid: actorUid },
      });
      break;
    }
    case "createImageUploadSessions":
    case "finalizeImageUploads":
    case "deleteUploadedImages": {
      events.push({
        aggregateType: "upload",
        aggregateId: actorUid,
        eventType: "upload.mutated",
        destinations: [],
        payload: { actor_uid: actorUid, action },
      });
      break;
    }
    case "cacheUserAvatar": {
      events.push({
        aggregateType: "user",
        aggregateId: actorUid,
        eventType: "user.avatar_updated",
        destinations: ["realtime"],
        payload: { actor_uid: actorUid },
      });
      break;
    }
    case "retryDeletionJob": {
      const jobId = String(payload.jobId ?? "");
      events.push({
        aggregateType: "job",
        aggregateId: jobId,
        eventType: "deletion_job.retried",
        destinations: [],
        payload: { job_id: jobId, actor_uid: actorUid },
      });
      break;
    }
    default:
      throw new Error(`unregistered-write-action:${action}`);
  }

  return events;
}
