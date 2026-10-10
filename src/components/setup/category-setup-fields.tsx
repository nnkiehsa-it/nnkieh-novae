"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n";
import type { FacilityCategoryDraft, IssueCategoryDraft } from "@/types/categories";
import { ListActionRow, ListSection } from "@/components/ui/list";
import { ListInputRow, ListNumberRow, ListSwitchRow } from "@/components/ui/list-controls";
import { ListPicker } from "@/components/ui/choice-select";

export function CategorySetupPanel({ children, enabled, onAdd, onEnabledChange, title }: {
  children: ReactNode;
  enabled: boolean;
  onAdd: () => void;
  onEnabledChange: (enabled: boolean) => void;
  title: string;
}) {
  const { t } = useI18n();
  return <section className="space-y-6">
    <ListSection footer={t("ui.setup.navHint")}>
      <ListSwitchRow label={title} name={title} checked={enabled} onCheckedChange={onEnabledChange} />
    </ListSection>
    <fieldset disabled={!enabled} className={`min-w-0 space-y-6${enabled ? "" : " disabled"}`}>
      {children}
    </fieldset>
    <ListSection>
      <ListActionRow icon={Plus} label={t("ui.setup.addCategory")} disabled={!enabled} onClick={onAdd} tone="brand" />
    </ListSection>
  </section>;
}

function CategoryIdentity({ draft, index, kind, onChange, onRemove }: {
  draft: FacilityCategoryDraft;
  index: number;
  kind: "facility" | "issue";
  onChange: (draft: FacilityCategoryDraft) => void;
  onRemove?: () => void;
}) {
  const { t } = useI18n();
  return <ListSection
    header={`${t(kind === "issue" ? "ui.access.issueCategory" : "ui.access.facilityCategory")} ${index + 1}`}
    footer={t("ui.setup.slugHint", { order: index + 1 })}
  >
    <ListInputRow id={`setup-${kind}-${index}-name`} label={t("ui.setup.categoryName")}
      value={draft.label} placeholder={t(kind === "issue" ? "ui.setup.issueExample" : "ui.setup.facilityExample")}
      onChange={(label) => onChange({ ...draft, label })} />
    <ListInputRow id={`setup-${kind}-${index}-identifier`} label={t("ui.common.slug")}
      value={draft.id} placeholder={kind === "issue" ? "campus-life" : "classroom-equipment"}
      onChange={(id) => onChange({ ...draft, id: id.toLowerCase().replace(/\s+/gu, "-") })} />
    {onRemove ? <ListActionRow icon={Trash2} label={t("ui.admin.deleteCategory")} tone="destructive" onClick={onRemove} /> : null}
  </ListSection>;
}

export function FacilityDraftEditor(props: {
  draft: FacilityCategoryDraft;
  index: number;
  onChange: (draft: FacilityCategoryDraft) => void;
  onRemove?: () => void;
}) {
  return <CategoryIdentity {...props} kind="facility" />;
}

export function IssueDraftEditor({ draft, index, onChange, onRemove }: {
  draft: IssueCategoryDraft;
  index: number;
  onChange: (draft: IssueCategoryDraft) => void;
  onRemove?: () => void;
}) {
  const { t } = useI18n();
  return <div className="space-y-6">
    <CategoryIdentity kind="issue" draft={draft} index={index} onRemove={onRemove}
      onChange={(identity) => onChange({ ...draft, id: identity.id, label: identity.label })} />
    <ListSection header={t("admin.categoryVisibility")}>
      <ListPicker label={t("ui.admin.readAccess")} value={draft.readAccess}
        onChange={(readAccess) => onChange({ ...draft, readAccess: readAccess as IssueCategoryDraft["readAccess"] })}
        options={[
          { label: t("ui.admin.schoolVisible"), value: "school" },
          { label: t("ui.admin.reviewedVisible"), value: "reviewed-school" },
          { label: t("ui.admin.ownerAdminOnly"), value: "owner-admin" },
        ]} />
      <ListSwitchRow label={t("ui.admin.showAuthor")} name={t("ui.admin.showAuthor")}
        checked={draft.authorVisible === true} onCheckedChange={(authorVisible) => onChange({ ...draft, authorVisible })} />
    </ListSection>
    <ListSection header={t("admin.categoryParticipation")}>
      <ListSwitchRow label={t("ui.admin.allowComments")} name={t("ui.admin.allowComments")}
        checked={draft.commentsEnabled} onCheckedChange={(commentsEnabled) => onChange({ ...draft, commentsEnabled })} />
      <ListSwitchRow label={t("ui.admin.enableSupport")} name={t("ui.admin.enableSupport")}
        checked={draft.supportEnabled === true} onCheckedChange={(supportEnabled) => onChange({ ...draft, supportEnabled })} />
      {draft.supportEnabled ? <>
        <ListNumberRow label={t("ui.admin.supportGoal")} value={draft.supportGoal ?? undefined}
          onChange={(supportGoal) => onChange({ ...draft, supportGoal: supportGoal || null })} />
        <ListNumberRow label={t("ui.admin.supportDays")} value={draft.supportDeadlineDays ?? undefined}
          unit={t("admin.unitDays")} onChange={(supportDeadlineDays) => onChange({ ...draft, supportDeadlineDays: supportDeadlineDays || null })} />
      </> : null}
    </ListSection>
  </div>;
}
