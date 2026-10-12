"use client";

import { Plus } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { ListGroup, ListRow } from "@/ui/list";
import { SwitchRow } from "@/ui/list-controls";
import { categoryName, type CategoryDraftValue, type CategoryKind, type CategoryManagement } from "./category-state";

/** Whether a kind of category is in use at all, the categories it has, and a way to add one. */
export function CategoryPanel({ kind, onOpen, state, value }: {
  kind: CategoryKind;
  onOpen: (index: number) => void;
  state: CategoryManagement;
  value: CategoryDraftValue;
}) {
  const { t } = useI18n();
  const issue = kind === "issue";
  const enabled = issue ? value.issuesEnabled : value.facilitiesEnabled;
  const items = issue ? value.issueCategories : value.facilityCategories;
  const featureLabel = t(issue ? "ui.admin.issueFeature" : "ui.admin.facilityFeature");

  return (
    <div className="grid gap-6">
      <ListGroup label={featureLabel}>
        <SwitchRow
          checked={enabled}
          label={featureLabel}
          onChange={(next) => state.draft.update(issue ? { issuesEnabled: next } : { facilitiesEnabled: next })}
        />
      </ListGroup>
      <ListGroup label={t(issue ? "ui.access.issueCategory" : "ui.access.facilityCategory")}>
        {items.map((item, index) => (
          <ListRow
            key={`${kind}-${index}`}
            label={categoryName(item.label, kind, index, t)}
            onClick={() => onOpen(index)}
            value={item.isDefault ? t("ui.admin.defaultCategory") : undefined}
          />
        ))}
        <ListRow
          disabled={!enabled}
          icon={<Plus />}
          label={t(issue ? "ui.admin.addIssueCategory" : "ui.admin.addFacilityCategory")}
          onClick={issue ? state.addIssue : state.addFacility}
        />
      </ListGroup>
    </div>
  );
}
