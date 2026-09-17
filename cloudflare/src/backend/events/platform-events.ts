import type { ResolvedDomainEvent, WriteOutcome } from "./domain-events.ts";

/** What the platform itself announces: its settings, access, uploads and accounts. */
export function platformEvents(outcome: WriteOutcome): ResolvedDomainEvent[] | null {
  const { action, payload, actorUid } = outcome;
  const events: ResolvedDomainEvent[] = [];
  switch (action) {
    case "clearOperationalErrors":
    case "clearScheduledWork":
    case "rebuildNotionArchive":
      return [];
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
    case "updatePlatformAdminNotificationPreferences": {
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
        destinations: ["realtime"],
        payload: { actor_uid: actorUid },
      });
      break;
    }
    case "savePlatformFeatures": {
      events.push({
        aggregateType: "system",
        aggregateId: "global",
        eventType: "system.features_updated",
        destinations: ["realtime"],
        payload: { actor_uid: actorUid },
      });
      break;
    }
    case "saveCategoryManagement": {
      events.push({
        aggregateType: "category",
        aggregateId: "global",
        eventType: "category.managed",
        destinations: ["realtime"],
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
        destinations: ["realtime"],
        payload: { actor_uid: actorUid },
      });
      break;
    }
    case "saveAccountAccessRule":
    case "deleteAccountAccessRule": {
      const targetType = String(payload.targetType ?? "");
      const targetUid = targetType === "uid" ? String(payload.targetValue ?? "") : "";
      if (!targetUid) {
        events.push({
          aggregateType: "platform",
          aggregateId: "global",
          eventType: "platform.settings_updated",
          destinations: ["realtime"],
          payload: { actor_uid: actorUid },
        });
        break;
      }
      events.push({
        aggregateType: "user",
        aggregateId: targetUid,
        eventType: "user.restricted",
        destinations: ["realtime"],
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
        destinations: ["realtime"],
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
    default:
      return null;
  }
  return events;
}
