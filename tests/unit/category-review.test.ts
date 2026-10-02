import { expect, it } from "vitest";
import { categoryManagementChanges } from "@/lib/category-review";
import { newIssueCategory } from "@/lib/category-management-state";
import type { CategoryManagementInput } from "@/services/categories";

it("reviews changed category rules rather than unchanged collection lengths", () => {
  const category = { ...newIssueCategory(0), id: "public", label: "Public proposals" };
  const before: CategoryManagementInput = { announcementMaxImages: 10, announcementCommentMaxImages: 1,
    announcementCommentsEnabled: true, issuesEnabled: true, facilitiesEnabled: false,
    issueCategories: [category], facilityCategories: [], deletedIssueCategoryIds: [], deletedFacilityCategoryIds: [] };
  const after = { ...before, issueCategories: [{ ...category, commentsEnabled: false }] };
  expect(categoryManagementChanges(before, after)).toEqual([{ key: "issueCategories:public:commentsEnabled",
    before: true, after: false, categoryName: "Public proposals", labelKey: "ui.admin.allowComments" }]);
  expect(categoryManagementChanges(before, { ...before, issueCategories: [], deletedIssueCategoryIds: ["public"] }))
    .toEqual([{ key: "issueCategories:public:removed", before: "Public proposals", after: null, labelKey: "admin.changeRemovedCategory" }]);
});
