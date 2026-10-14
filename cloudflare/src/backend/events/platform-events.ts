import type { Announcers, ResolvedDomainEvent } from "./domain-events.ts";

const nothing = () => [];

function openedBy(actorUid: string): ResolvedDomainEvent[] {
  return [{
    aggregateType: "user", aggregateId: actorUid, eventType: "notification.marked_opened",
    destinations: ["realtime"], payload: { actor_uid: actorUid },
  }];
}

function pushChangedBy(actorUid: string, action: string): ResolvedDomainEvent[] {
  return [{
    aggregateType: "user", aggregateId: actorUid, eventType: "push_token.updated",
    destinations: [], payload: { actor_uid: actorUid, action },
  }];
}

function settingsChangedBy(actorUid: string): ResolvedDomainEvent[] {
  return [{
    aggregateType: "platform", aggregateId: "global", eventType: "platform.settings_updated",
    destinations: ["realtime"], payload: { actor_uid: actorUid },
  }];
}

function uploadsChangedBy(actorUid: string, action: string): ResolvedDomainEvent[] {
  return [{
    aggregateType: "upload", aggregateId: actorUid, eventType: "upload.mutated",
    destinations: [], payload: { actor_uid: actorUid, action },
  }];
}

function accessScoped(targetUid: string, actorUid: string): ResolvedDomainEvent {
  return {
    aggregateType: "user", aggregateId: targetUid, eventType: "user.access_scoped",
    destinations: ["realtime"], payload: { target_uid: targetUid, actor_uid: actorUid },
  };
}

/** A rule for one account restricts that account; a rule for a domain or pattern changes the platform's settings. */
function ruleChanged(input: { targetType: string; targetValue: string }, actorUid: string): ResolvedDomainEvent[] {
  if (input.targetType !== "uid") return settingsChangedBy(actorUid);
  return [{
    aggregateType: "user", aggregateId: input.targetValue, eventType: "user.restricted",
    destinations: ["realtime"], payload: { target_uid: input.targetValue, actor_uid: actorUid },
  }];
}

/** What the platform itself announces: its settings, access, uploads and accounts. */
export const PLATFORM_ANNOUNCERS = {
  clearOperationalErrors: nothing,
  clearScheduledWork: nothing,
  rebuildNotionArchive: nothing,
  markAnnouncementsOpened: ({ actorUid }) => openedBy(actorUid),
  markNotificationsOpened: ({ actorUid }) => openedBy(actorUid),
  registerPushToken: ({ actorUid }) => pushChangedBy(actorUid, "registerPushToken"),
  unregisterPushToken: ({ actorUid }) => pushChangedBy(actorUid, "unregisterPushToken"),
  updatePlatformAdminNotificationPreferences: ({ actorUid }) =>
    pushChangedBy(actorUid, "updatePlatformAdminNotificationPreferences"),
  completeInitialSetup: ({ actorUid }) => [{
    aggregateType: "system", aggregateId: "global", eventType: "system.setup_completed",
    destinations: ["realtime"], payload: { actor_uid: actorUid },
  }],
  savePlatformFeatures: ({ actorUid }) => [{
    aggregateType: "system", aggregateId: "global", eventType: "system.features_updated",
    destinations: ["realtime"], payload: { actor_uid: actorUid },
  }],
  saveCategoryManagement: ({ actorUid }) => [{
    aggregateType: "category", aggregateId: "global", eventType: "category.managed",
    destinations: ["realtime"], payload: { actor_uid: actorUid },
  }],
  retryOperationalWork: ({ actorUid }) => settingsChangedBy(actorUid),
  saveOperationPolicies: ({ actorUid }) => settingsChangedBy(actorUid),
  savePlatformSettings: ({ actorUid }) => settingsChangedBy(actorUid),
  saveAccountAccessRule: ({ input, actorUid }) => ruleChanged(input, actorUid),
  deleteAccountAccessRule: ({ input, actorUid }) => ruleChanged(input, actorUid),
  setUserAccessScope: ({ input, actorUid }) => [accessScoped(input.uid, actorUid)],
  saveScopeMembers: ({ result, actorUid }) => result.changedUids.map((uid) => accessScoped(uid, actorUid)),
  createImageUploadSessions: ({ actorUid }) => uploadsChangedBy(actorUid, "createImageUploadSessions"),
  finalizeImageUploads: ({ actorUid }) => uploadsChangedBy(actorUid, "finalizeImageUploads"),
  deleteUploadedImages: ({ actorUid }) => uploadsChangedBy(actorUid, "deleteUploadedImages"),
  cacheUserAvatar: ({ actorUid }) => [{
    aggregateType: "user", aggregateId: actorUid, eventType: "user.avatar_updated",
    destinations: ["realtime"], payload: { actor_uid: actorUid },
  }],
} satisfies Partial<Announcers>;
