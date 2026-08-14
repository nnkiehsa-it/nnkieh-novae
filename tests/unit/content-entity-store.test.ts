import { describe, expect, it } from "vitest";
import {
  beginContentEntityRead,
  clearContentEntityScope,
  getContentEntity,
  getDetailContentEntity,
  mergeContentEntityRead,
  patchContentEntity,
  removeContentEntity,
} from "../../src/lib/content-entity-store";
import type { IssueRecord } from "../../src/types";

function issue(id: string, title: string, supported = false) {
  return {
    currentUserSupported: supported,
    id,
    support_count: supported ? 4 : 3,
    title,
  } as unknown as IssueRecord;
}

describe("content entity store", () => {
  it("shares list state without treating a summary as authoritative detail", () => {
    const scope = "entity-list-detail";
    mergeContentEntityRead(
      scope,
      "issue",
      issue("one", "List title"),
      beginContentEntityRead(),
      "summary",
    );

    expect(getContentEntity<IssueRecord>(scope, "issue", "one")?.title).toBe(
      "List title",
    );
    expect(getDetailContentEntity(scope, "issue", "one")).toBeUndefined();
    clearContentEntityScope(scope);
  });

  it("does not let a later list summary replace authoritative detail content", () => {
    const scope = "entity-detail-protection";
    mergeContentEntityRead(
      scope,
      "issue",
      { ...issue("one", "Detail title"), content: "Full detail" },
      beginContentEntityRead(),
    );
    mergeContentEntityRead(
      scope,
      "issue",
      { ...issue("one", "Updated list title"), content: "List excerpt" },
      beginContentEntityRead(),
      "summary",
    );

    expect(getDetailContentEntity<IssueRecord>(scope, "issue", "one")).toMatchObject({
      content: "Full detail",
      title: "Updated list title",
    });
    clearContentEntityScope(scope);
  });

  it("does not let an older request overwrite a newer mutation", () => {
    const scope = "entity-read-mutation";
    mergeContentEntityRead(scope, "issue", issue("one", "Title"), beginContentEntityRead());
    const staleRead = beginContentEntityRead();
    patchContentEntity<IssueRecord>(scope, "issue", "one", {
      currentUserSupported: true,
      support_count: 4,
    });
    mergeContentEntityRead(scope, "issue", issue("one", "Title", false), staleRead);

    expect(getContentEntity<IssueRecord>(scope, "issue", "one")).toMatchObject({
      currentUserSupported: true,
      support_count: 4,
    });
    clearContentEntityScope(scope);
  });

  it("does not let a slower read overwrite a later read", () => {
    const scope = "entity-read-order";
    const slowRead = beginContentEntityRead();
    const fastRead = beginContentEntityRead();
    mergeContentEntityRead(scope, "issue", issue("one", "New title"), fastRead);
    mergeContentEntityRead(scope, "issue", issue("one", "Old title"), slowRead);

    expect(getContentEntity<IssueRecord>(scope, "issue", "one")?.title).toBe(
      "New title",
    );
    expect(removeContentEntity(scope, "issue", "one")).toBe(true);
    expect(getContentEntity(scope, "issue", "one")).toBeUndefined();
  });
});
