import type { useCategoryManagement } from "@/hooks/use-category-management";
import type { Translate } from "../shared/translate";

export type CategoryManagement = ReturnType<typeof useCategoryManagement>;

/** The draft once it has loaded; the screen only draws categories from this. */
export type CategoryDraftValue = NonNullable<CategoryManagement["value"]>;

export type CategoryKind = "facility" | "issue";

/** A category being edited: which list it is in, and where. */
export interface EditTarget {
  index: number;
  kind: CategoryKind;
}

/** A category's name, or a numbered stand-in for one that has not been named yet. */
export function categoryName(label: string, kind: CategoryKind, index: number, t: Translate) {
  return label || `${t(kind === "issue" ? "ui.access.issueCategory" : "ui.access.facilityCategory")} ${index + 1}`;
}
