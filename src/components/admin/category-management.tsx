"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { useI18n } from "@/i18n";
import { useCategoryManagement } from "@/hooks/use-category-management";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton";
import { ApplyReviewDialog } from "@/components/admin/apply-review-dialog";
import { CategoryEditor } from "@/components/admin/category-editors";
import { ContentTransition, StateTransition } from "@/components/motion/state-transition";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ListActionRow, ListNavRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-controls";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ErrorState } from "@/components/ui/page-state";
import { SaveBar } from "@/components/ui/save-bar";
import type { FacilityCategoryConfig, IssueCategoryConfig } from "@/types/categories";

const CHANGE_LABELS: Record<string, string> = {
  announcementCommentsEnabled: "ui.admin.announcementComments",
  deletedFacilityCategoryIds: "admin.changeRemovedFacilities",
  deletedIssueCategoryIds: "admin.changeRemovedIssues",
  facilitiesEnabled: "ui.admin.facilityFeature",
  facilityCategories: "ui.nav.facilities",
  issueCategories: "ui.nav.issues",
  issuesEnabled: "ui.admin.issueFeature",
};

type AnyCategory = FacilityCategoryConfig | IssueCategoryConfig;

/**
 * The categories, as a list of categories.
 *
 * Every category used to be spelled out in full on this page at once — up to
 * ten decisions each, one after another, so a platform with eight of them made
 * a screen nobody could read. A category is a row now, and the decisions inside
 * it open in the sheet that already carries this kind of work elsewhere.
 */
export function CategoryManagement() {
  const { t } = useI18n();
  const state = useCategoryManagement();
  const [kind, setKind] = React.useState("issue");
  const [editing, setEditing] = React.useState<number | null>(null);
  const [retainedEditing, setRetainedEditing] = React.useState<{
    index: number;
    item: AnyCategory;
    kind: string;
  } | null>(null);
  useUnsavedChanges(state.draft.changes.length, state.draft.reset);
  const value = state.value;

  if (state.error) return <ErrorState error={state.error} onRetry={() => void state.load()} />;
  if (state.loading || !value) return <AdminListSkeleton groups={2} rows={5} />;

  const areas = {
    facility: {
      addLabel: t("ui.admin.addFacilityCategory"),
      enabled: value.facilitiesEnabled,
      featureLabel: t("ui.admin.facilityFeature"),
      items: value.facilityCategories as AnyCategory[],
      onAdd: state.addFacility,
      onDelete: state.deleteFacility,
      onFeatureChange: (next: boolean) => state.draft.update({ facilitiesEnabled: next }),
      onSetDefault: state.setDefaultFacility,
      onUpdate: state.updateFacility,
      placeholder: t("ui.access.facilityCategory"),
    },
    issue: {
      addLabel: t("ui.admin.addIssueCategory"),
      enabled: value.issuesEnabled,
      featureLabel: t("ui.admin.issueFeature"),
      items: value.issueCategories as AnyCategory[],
      onAdd: state.addIssue,
      onDelete: state.deleteIssue,
      onFeatureChange: (next: boolean) => state.draft.update({ issuesEnabled: next }),
      onSetDefault: state.setDefaultIssue,
      onUpdate: state.updateIssue,
      placeholder: t("ui.access.issueCategory"),
    },
  } as const;
  const area = kind === "facility" ? areas.facility : kind === "issue" ? areas.issue : null;
  const activeIndex = editing ?? (retainedEditing?.kind === kind ? retainedEditing.index : null);
  const editingItem = editing !== null && area
    ? area.items[editing]
    : retainedEditing?.kind === kind
      ? retainedEditing.item
      : undefined;
  const nameOf = (item: AnyCategory, index: number) =>
    item.label || `${area?.placeholder ?? ""} ${index + 1}`;

  return (
    <div className="space-y-6">
      <LiquidTabs
        ariaLabel={t("ui.admin.contentType")}
        onValueChange={(next) => {
          setEditing(null);
          setRetainedEditing(null);
          setKind(next);
        }}
        options={[
          { label: t("ui.nav.issues"), value: "issue" },
          { label: t("ui.nav.facilities"), value: "facility" },
          { label: t("ui.nav.announcements"), value: "announcement" },
        ]}
        value={kind}
      />

      <StateTransition className="min-w-0" data-admin-content identity={kind}>
        <ContentTransition identity={kind}>
          {area ? (
            <div className="space-y-6">
              <ListSection>
                <ListSwitchRow
                  checked={area.enabled}
                  label={area.featureLabel}
                  name={area.featureLabel}
                  onCheckedChange={area.onFeatureChange}
                />
              </ListSection>
              <ListSection>
                {area.items.map((item, index) => (
                  <ListNavRow
                    key={`${kind}-${index}`}
                    label={nameOf(item, index)}
                    onClick={() => {
                      setRetainedEditing({ index, item, kind });
                      setEditing(index);
                    }}
                    value={item.isDefault ? t("ui.admin.defaultCategory") : undefined}
                  />
                ))}
                <ListActionRow
                  disabled={!area.enabled}
                  icon={Plus}
                  label={area.addLabel}
                  onClick={area.onAdd}
                  tone="brand"
                />
              </ListSection>
            </div>
          ) : (
            <ListSection>
              <ListSwitchRow
                checked={value.announcementCommentsEnabled}
                label={t("ui.admin.announcementComments")}
                name={t("ui.admin.announcementComments")}
                onCheckedChange={(next) =>
                  state.draft.update({ announcementCommentsEnabled: next })
                }
              />
            </ListSection>
          )}
        </ContentTransition>
      </StateTransition>

      <Sheet onOpenChange={(open) => !open && setEditing(null)} open={editing !== null}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editingItem ? nameOf(editingItem, activeIndex ?? 0) : ""}
            </SheetTitle>
          </SheetHeader>
          {area && editingItem && activeIndex !== null ? (
            <CategoryEditor
              identifierLocked={state.persisted.has(editingItem.id)}
              item={editingItem}
              onChange={(next) => area.onUpdate(activeIndex, next)}
              onDefault={() => area.onSetDefault(activeIndex)}
              onDelete={() => {
                area.onDelete(activeIndex);
                setEditing(null);
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <SaveBar
        changeCount={state.draft.changes.length}
        disabled={!state.draft.valid}
        onDiscard={state.draft.reset}
        onSave={() => void state.draft.submit()}
        status={state.draft.status}
      />
      <ApplyReviewDialog
        changes={state.draft.changes}
        describeChange={(key) => t(CHANGE_LABELS[key] ?? key)}
        describeImpact={(key) => {
          const [jobType, scope] = key.split(":");
          return jobType === "announcement-comments"
            ? t("ui.admin.announcementCommentPolicy")
            : t("ui.admin.issueCommentPolicy", { scope });
        }}
        impact={state.draft.impact}
        onCancel={state.draft.cancel}
        onConfirm={() => void state.draft.confirm()}
        open={state.draft.impact !== null}
      />
    </div>
  );
}
