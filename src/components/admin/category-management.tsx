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
import { ListActionRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-controls";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ErrorState } from "@/components/ui/page-state";
import { SaveBar } from "@/components/ui/save-bar";

const CHANGE_LABELS: Record<string, string> = {
  announcementCommentsEnabled: "ui.admin.announcementComments",
  deletedFacilityCategoryIds: "admin.changeRemovedFacilities",
  deletedIssueCategoryIds: "admin.changeRemovedIssues",
  facilitiesEnabled: "ui.admin.facilityFeature",
  facilityCategories: "ui.nav.facilities",
  issueCategories: "ui.nav.issues",
  issuesEnabled: "ui.admin.issueFeature",
};

export function CategoryManagement() {
  const { t } = useI18n();
  const state = useCategoryManagement();
  const [kind, setKind] = React.useState("issue");
  useUnsavedChanges(state.draft.changes.length, state.draft.reset);
  const value = state.value;

  if (state.error) return <ErrorState error={state.error} onRetry={() => void state.load()} />;
  if (state.loading || !value) return <AdminListSkeleton groups={2} rows={5} />;

  return (
    <div className="space-y-6">
      <LiquidTabs
        ariaLabel={t("ui.admin.contentType")}
        onValueChange={setKind}
        options={[
          { label: t("ui.nav.issues"), value: "issue" },
          { label: t("ui.nav.facilities"), value: "facility" },
          { label: t("ui.nav.announcements"), value: "announcement" },
        ]}
        value={kind}
      />

      <StateTransition className="min-w-0" data-admin-content identity={kind}>
        <ContentTransition identity={kind}>
          {kind === "issue" ? (
            <div className="space-y-6">
              <ListSection footer={t("ui.admin.navDescription")}>
                <ListSwitchRow
                  checked={value.issuesEnabled}
                  label={t("ui.admin.issueFeature")}
                  name={t("ui.admin.issueFeature")}
                  onCheckedChange={(next) => state.draft.update({ issuesEnabled: next })}
                />
              </ListSection>
              {value.issueCategories.map((item, index) => (
                <CategoryEditor
                  identifierLocked={state.persisted.has(item.id)}
                  index={index}
                  item={item}
                  key={`issue-${index}`}
                  kind="issue"
                  onChange={(next) => state.updateIssue(index, next)}
                  onDefault={() => state.setDefaultIssue(index)}
                  onDelete={() => state.deleteIssue(index)}
                />
              ))}
              <ListSection>
                <ListActionRow
                  disabled={!value.issuesEnabled}
                  icon={Plus}
                  label={t("ui.admin.addIssueCategory")}
                  onClick={state.addIssue}
                  tone="brand"
                />
              </ListSection>
            </div>
          ) : null}

          {kind === "facility" ? (
            <div className="space-y-6">
              <ListSection footer={t("ui.admin.navDescription")}>
                <ListSwitchRow
                  checked={value.facilitiesEnabled}
                  label={t("ui.admin.facilityFeature")}
                  name={t("ui.admin.facilityFeature")}
                  onCheckedChange={(next) => state.draft.update({ facilitiesEnabled: next })}
                />
              </ListSection>
              {value.facilityCategories.map((item, index) => (
                <CategoryEditor
                  identifierLocked={state.persisted.has(item.id)}
                  index={index}
                  item={item}
                  key={`facility-${index}`}
                  kind="facility"
                  onChange={(next) => state.updateFacility(index, next)}
                  onDefault={() => state.setDefaultFacility(index)}
                  onDelete={() => state.deleteFacility(index)}
                />
              ))}
              <ListSection>
                <ListActionRow
                  disabled={!value.facilitiesEnabled}
                  icon={Plus}
                  label={t("ui.admin.addFacilityCategory")}
                  onClick={state.addFacility}
                  tone="brand"
                />
              </ListSection>
            </div>
          ) : null}

          {kind === "announcement" ? (
            <ListSection footer={t("ui.admin.announcementCommentsDescription")}>
              <ListSwitchRow
                checked={value.announcementCommentsEnabled}
                label={t("ui.admin.announcementComments")}
                name={t("ui.admin.announcementComments")}
                onCheckedChange={(next) =>
                  state.draft.update({ announcementCommentsEnabled: next })
                }
              />
            </ListSection>
          ) : null}
        </ContentTransition>
      </StateTransition>

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
