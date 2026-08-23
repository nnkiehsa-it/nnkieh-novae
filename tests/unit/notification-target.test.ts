import { describe, expect, it } from "vitest";

import { notificationTargetPath } from "@/lib/notification-target";
import type { NotificationRecord } from "@/types";

function notification(overrides: Partial<NotificationRecord>): NotificationRecord {
  return {
    actor_uid: null,
    body_preview: null,
    comment_id: null,
    created_at: null,
    id: "notification-1",
    is_read: false,
    issue_category: null,
    source: "user",
    target_id: "target-1",
    target_type: "issue",
    title: "Test",
    type: "issue_status_changed",
    ...overrides,
  };
}

describe("notificationTargetPath", () => {
  it("builds issue comment destinations without a preliminary fetch", () => {
    expect(notificationTargetPath(notification({
      comment_id: "comment/1",
      issue_category: "public-issues",
      type: "issue_comment_created",
    }))).toBe("/issues/public-issues/target-1?tab=comments&comment=comment%2F1");
  });

  it("uses direct announcement and facility identifiers", () => {
    expect(notificationTargetPath(notification({
      target_type: "announcement",
      type: "announcement_created",
    }))).toBe("/announcements/target-1");
    expect(notificationTargetPath(notification({
      target_type: "facility",
      type: "facility_status_changed",
    }))).toBe("/facilities/target-1");
  });

  it("does not navigate deleted issues", () => {
    expect(notificationTargetPath(notification({ type: "issue_deleted" }))).toBeNull();
  });
});
