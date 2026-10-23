import { Trash } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import type { FacilityCategoryDraft, IssueCategoryDraft } from "@/types/categories";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { ListGroup } from "@/ui/list";
import { InputRow, NumberRow, PickerRow, SwitchRow } from "@/ui/list-controls";
import { Tooltip } from "@/ui/popover";

function normalizeCategoryId(value: string) {
  return value.toLowerCase().replace(/\s+/gu, "-");
}

function DraftTitle({ isDefault, title }: { isDefault: boolean; title: string }) {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-2">
      {title}
      {isDefault ? <Chip>{t("ui.common.default")}</Chip> : null}
    </span>
  );
}

function RemoveButton({ onRemove }: { onRemove?: () => void }) {
  const { t } = useI18n();
  if (!onRemove) return null;
  return (
    <Tooltip label={t("ui.admin.deleteCategory")}>
      <Button aria-label={t("ui.admin.deleteCategory")} onClick={onRemove} size="icon-sm" variant="ghost">
        <Trash />
      </Button>
    </Tooltip>
  );
}

interface DraftProps<Draft> {
  draft: Draft;
  index: number;
  onChange: (draft: Draft) => void;
  onRemove?: () => void;
}

export function FacilityDraft({ draft, index, onChange, onRemove }: DraftProps<FacilityCategoryDraft>) {
  const { t } = useI18n();
  return (
    <ListGroup
      action={<RemoveButton onRemove={onRemove} />}
      footer={t("ui.setup.slugHint", { order: index + 1 })}
      title={<DraftTitle isDefault={draft.isDefault} title={`${t("ui.access.facilityCategory")} ${index + 1}`} />}
    >
      <InputRow label={t("ui.setup.categoryName")} onChange={(label) => onChange({ ...draft, label })} placeholder={t("ui.setup.facilityExample")} value={draft.label} />
      <InputRow label={t("ui.common.slug")} onChange={(id) => onChange({ ...draft, id: normalizeCategoryId(id) })} placeholder="classroom-equipment" value={draft.id} />
    </ListGroup>
  );
}

export function IssueDraft({ draft, index, onChange, onRemove }: DraftProps<IssueCategoryDraft>) {
  const { t } = useI18n();
  return (
    <ListGroup
      action={<RemoveButton onRemove={onRemove} />}
      footer={t("ui.setup.slugHint", { order: index + 1 })}
      title={<DraftTitle isDefault={draft.isDefault} title={t("ui.setup.issueOrder", { order: index + 1 })} />}
    >
      <InputRow label={t("ui.setup.categoryName")} onChange={(label) => onChange({ ...draft, label })} placeholder={t("ui.setup.issueExample")} value={draft.label} />
      <InputRow label={t("ui.common.slug")} onChange={(id) => onChange({ ...draft, id: normalizeCategoryId(id) })} placeholder="campus-life" value={draft.id} />
      <PickerRow
        label={t("ui.admin.readAccess")}
        onChange={(readAccess) => onChange({ ...draft, readAccess })}
        options={[
          { label: t("ui.admin.schoolVisible"), value: "school" },
          { label: t("ui.admin.reviewedVisible"), value: "reviewed-school" },
          { label: t("ui.admin.ownerAdminOnly"), value: "owner-admin" },
        ]}
        value={draft.readAccess}
      />
      <SwitchRow checked={draft.authorVisible === true} label={t("ui.admin.showAuthor")} onChange={(authorVisible) => onChange({ ...draft, authorVisible })} />
      <SwitchRow checked={draft.commentsEnabled} label={t("ui.admin.allowComments")} onChange={(commentsEnabled) => onChange({ ...draft, commentsEnabled })} />
      <SwitchRow checked={draft.supportEnabled === true} label={t("ui.admin.enableSupport")} onChange={(supportEnabled) => onChange({ ...draft, supportEnabled })} />
      {draft.supportEnabled ? (
        <>
          <NumberRow label={t("ui.admin.supportGoal")} onChange={(supportGoal) => onChange({ ...draft, supportGoal: supportGoal || null })} value={draft.supportGoal ?? undefined} />
          <NumberRow
            label={t("ui.admin.supportDays")}
            onChange={(supportDeadlineDays) => onChange({ ...draft, supportDeadlineDays: supportDeadlineDays || null })}
            unit={t("ui.admin.daysPlaceholder")}
            value={draft.supportDeadlineDays ?? undefined}
          />
        </>
      ) : null}
    </ListGroup>
  );
}
