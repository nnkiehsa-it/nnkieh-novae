import type { ResolvedDomainEvent, WriteOutcome } from "./domain-events.ts";

/** What the platform itself announces: its settings, access, uploads and accounts. */
export function platformEvents(outcome: WriteOutcome): ResolvedDomainEvent[] | null {
  const { action, payload, actorUid } = outcome;
  const events: ResolvedDomainEvent[] = [];
  switch (action) {
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
    case "retryOperationalWork":
    case "saveOperationPolicies":
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
      return null;
  }
  return events;
}
