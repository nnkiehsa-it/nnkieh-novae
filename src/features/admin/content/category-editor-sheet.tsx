import * as React from "react";
import { useI18n } from "@/i18n";
import type { FacilityCategoryConfig, IssueCategoryConfig } from "@/types/categories";
import { Sheet } from "@/ui/sheet";
import { useRetained } from "../shared/use-retained";
import { FacilityCategoryEditor, IssueCategoryEditor } from "./category-editors";
import { categoryName, type CategoryDraftValue, type CategoryManagement, type EditTarget } from "./category-state";

type Entry =
  | { index: number; item: FacilityCategoryConfig; kind: "facility" }
  | { index: number; item: IssueCategoryConfig; kind: "issue" };

interface BodyProps<Config> {
  index: number;
  item: Config;
  onClose: () => void;
  state: CategoryManagement;
}

/** The category the target points at, if it is still in the draft. */
function entryAt(target: EditTarget | null, value: CategoryDraftValue): Entry | null {
  if (!target) return null;
  const { index, kind } = target;
  if (kind === "issue") {
    const item = value.issueCategories[index];
    return item ? { index, item, kind } : null;
  }
  const item = value.facilityCategories[index];
  return item ? { index, item, kind } : null;
}

function IssueBody({ index, item, onClose, state }: BodyProps<IssueCategoryConfig>) {
  const saved = state.draft.baseline?.issueCategories.find((candidate) => candidate.id === item.id);
  return (
    <IssueCategoryEditor
      item={item}
      locked={state.persisted.has(item.id)}
      onChange={(next) => state.updateIssue(index, next)}
      onDefault={() => state.setDefaultIssue(index)}
      onDelete={() => { state.deleteIssue(index); onClose(); }}
      onRestore={saved ? () => state.updateIssue(index, { ...saved, isDefault: item.isDefault, sortOrder: item.sortOrder }) : undefined}
    />
  );
}

function FacilityBody({ index, item, onClose, state }: BodyProps<FacilityCategoryConfig>) {
  const saved = state.draft.baseline?.facilityCategories.find((candidate) => candidate.id === item.id);
  return (
    <FacilityCategoryEditor
      item={item}
      locked={state.persisted.has(item.id)}
      onChange={(next) => state.updateFacility(index, next)}
      onDefault={() => state.setDefaultFacility(index)}
      onDelete={() => { state.deleteFacility(index); onClose(); }}
      onRestore={saved ? () => state.updateFacility(index, { ...saved, isDefault: item.isDefault, sortOrder: item.sortOrder }) : undefined}
    />
  );
}

/**
 * Where one category is edited. It keeps showing the category it was opened
 * on while it closes, even when closing removed that category from the draft.
 */
export function CategoryEditorSheet({ onClose, state, target, value }: {
  onClose: () => void;
  state: CategoryManagement;
  target: EditTarget | null;
  value: CategoryDraftValue;
}) {
  const { t } = useI18n();
  const live = React.useMemo(() => entryAt(target, value), [target, value]);
  const entry = useRetained(live);
  if (!entry) return null;

  return (
    <Sheet
      onOpenChange={(open) => { if (!open) onClose(); }}
      open={target !== null}
      title={categoryName(entry.item.label, entry.kind, entry.index, t)}
    >
      {entry.kind === "issue"
        ? <IssueBody index={entry.index} item={entry.item} key={`issue:${entry.index}`} onClose={onClose} state={state} />
        : <FacilityBody index={entry.index} item={entry.item} key={`facility:${entry.index}`} onClose={onClose} state={state} />}
    </Sheet>
  );
}
