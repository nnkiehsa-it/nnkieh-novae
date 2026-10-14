import { describe, expect, it } from "vitest";

import { notificationTargetPath } from "@/lib/notification-target";
import type { NotificationRecord } from "@/types";

function notification(overrides: Partial<NotificationRecord>): NotificationRecord {
  return {
    actorUid: null,
    bodyPreview: null,
    commentId: null,
    createdAt: "2026-09-26T10:00:00.000Z",
    id: "notification-1",
    isRead: false,
    issueCategory: null,
    newStatus: null,
    oldStatus: null,
    source: "user",
    targetId: "target-1",
    targetType: "issue",
    title: "Test",
    type: "issue_status_changed",
    ...overrides,
  };
}

describe("notificationTargetPath", () => {
  it("builds issue comment destinations without a preliminary fetch", () => {
    expect(notificationTargetPath(notification({
      commentId: "comment/1",
      issueCategory: "public-issues",
      type: "issue_comment_created",
    }))).toBe("/issues/public-issues/target-1?tab=comments&comment=comment%2F1");
  });

  it("uses direct announcement and facility identifiers", () => {
    expect(notificationTargetPath(notification({
      targetType: "announcement",
      type: "announcement_created",
    }))).toBe("/announcements/target-1");
    expect(notificationTargetPath(notification({
      targetType: "facility",
      type: "facility_status_changed",
    }))).toBe("/facilities/target-1");
  });

  it("does not navigate deleted issues", () => {
    expect(notificationTargetPath(notification({ type: "issue_deleted" }))).toBeNull();
  });
});
