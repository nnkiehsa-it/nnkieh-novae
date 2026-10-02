import { diffDraft, type DraftChange } from "@/lib/draft-diff";
import type { CategoryManagementInput } from "@/services/categories";

export interface CategoryChange extends DraftChange {
  categoryName?: string;
  labelKey: string;
}

const LABELS: Record<string, string> = {
  announcementMaxImages: "ui.admin.announcementImageLimit", announcementCommentMaxImages: "ui.admin.commentImageLimit",
  announcementCommentsEnabled: "ui.admin.announcementComments", facilitiesEnabled: "ui.admin.facilityFeature", issuesEnabled: "ui.admin.issueFeature",
  id: "ui.common.slug", label: "ui.common.name", isDefault: "ui.admin.defaultCategory",
  readAccess: "ui.admin.readAccess", authorVisible: "ui.admin.showAuthor", supportEnabled: "ui.admin.enableSupport",
  supportGoal: "ui.admin.supportGoal", supportDeadlineDays: "ui.admin.supportDays", commentsEnabled: "ui.admin.allowComments",
  maxImages: "admin.contentImageLimit", commentMaxImages: "ui.admin.commentImageLimit",
  sortOrder: "admin.categoryOrder",
};

/** Review the actual rules in each category, including additions and removals. */
export function categoryManagementChanges(before: CategoryManagementInput, after: CategoryManagementInput): CategoryChange[] {
  const omitCategories = (value: CategoryManagementInput) => ({ ...value, issueCategories: [], facilityCategories: [], deletedIssueCategoryIds: [], deletedFacilityCategoryIds: [] });
  const changes: CategoryChange[] = diffDraft(omitCategories(before), omitCategories(after)).map((change) => ({ ...change, labelKey: LABELS[change.key] }));
  for (const kind of ["issueCategories", "facilityCategories"] as const) {
    const previous = new Map(before[kind].map((item) => [item.id, item]));
    const next = new Map(after[kind].map((item) => [item.id, item]));
    for (const item of before[kind]) if (!next.has(item.id)) {
      changes.push({ key: `${kind}:${item.id}:removed`, before: item.label, after: null, labelKey: "admin.changeRemovedCategory" });
    }
    for (const item of after[kind]) {
      const original = previous.get(item.id);
      if (!original) {
        changes.push({ key: `${kind}:${item.id}:added`, before: null, after: item.label, labelKey: "admin.changeAddedCategory" });
        for (const change of diffDraft<Record<string, unknown>>({}, item as unknown as Record<string, unknown>)) {
          if (change.key === "label") continue;
          changes.push({ ...change, key: `${kind}:${item.id}:${change.key}`, categoryName: item.label,
            labelKey: change.key === "authorDeleteEnabled"
              ? kind === "issueCategories" ? "ui.admin.allowIssueAuthorDelete" : "ui.admin.allowFacilityAuthorDelete"
              : LABELS[change.key] });
        }
        continue;
      }
      for (const change of diffDraft(original, item)) {
        changes.push({ ...change, key: `${kind}:${item.id}:${change.key}`, categoryName: item.label,
          labelKey: change.key === "authorDeleteEnabled"
            ? kind === "issueCategories" ? "ui.admin.allowIssueAuthorDelete" : "ui.admin.allowFacilityAuthorDelete"
            : LABELS[change.key] });
      }
    }
  }
  return changes;
}
