import { useI18n } from "@/i18n";
import { ListGroup } from "@/ui/list";
import { ChoiceRow, InputRow, NumberRow, PickerRow, SwitchRow } from "@/ui/list-controls";
import type { FacilityCategoryConfig, IssueCategoryConfig } from "@/types/categories";
import { READ_ACCESS_KEYS, READ_ACCESS_LEVELS } from "../shared/read-access";
import { CategoryDeleteAction } from "./category-delete-action";

const MAX_SUPPORT_COUNT = 2_147_483_647;

type Patch<Config> = (changes: Partial<Config>) => void;

/** What the category is called and where it sits among the others. */
export function IdentityGroups({ item, locked, onChange, onDefault }: {
  item: FacilityCategoryConfig;
  /** An identifier the backend already holds cannot be renamed. */
  locked: boolean;
  onChange: Patch<FacilityCategoryConfig>;
  onDefault: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <ListGroup title={t("admin.categoryIdentity")}>
        <InputRow label={t("ui.common.name")} maxLength={40} onChange={(label) => onChange({ label })} value={item.label} />
        <InputRow
          disabled={locked}
          label={t("ui.common.slug")}
          onChange={(id) => onChange({ id: id.toLowerCase().replace(/\s+/gu, "-") })}
          value={item.id}
        />
      </ListGroup>
      <ListGroup label={t("ui.admin.defaultCategory")} role="radiogroup">
        <ChoiceRow label={t("ui.admin.defaultCategory")} onSelect={onDefault} selected={item.isDefault} />
      </ListGroup>
    </>
  );
}

/** Who can read a proposal category, and whether authors are named. Fixed once the category exists. */
export function VisibilityGroup({ item, locked, onChange }: {
  item: IssueCategoryConfig;
  locked: boolean;
  onChange: Patch<IssueCategoryConfig>;
}) {
  const { t } = useI18n();
  return (
    <ListGroup footer={locked ? t("admin.categoryPrivacyLocked") : undefined} title={t("admin.categoryVisibility")}>
      <PickerRow
        disabled={locked}
        label={t("ui.admin.readAccess")}
        onChange={(readAccess) => onChange({ authorVisible: readAccess === "owner-admin" ? true : item.authorVisible, readAccess })}
        options={READ_ACCESS_LEVELS.map((level) => ({ label: t(READ_ACCESS_KEYS[level]), value: level }))}
        value={item.readAccess}
      />
      <SwitchRow
        checked={item.authorVisible}
        disabled={locked || item.readAccess === "owner-admin"}
        label={t("ui.admin.showAuthor")}
        onChange={(authorVisible) => onChange({ authorVisible })}
      />
    </ListGroup>
  );
}

/** Comments, and the support goal that turns a proposal into a petition. */
export function ParticipationGroup({ item, onChange }: { item: IssueCategoryConfig; onChange: Patch<IssueCategoryConfig> }) {
  const { t } = useI18n();
  return (
    <ListGroup footer={item.supportEnabled ? t("admin.supportIntegerHelp") : undefined} title={t("admin.categoryParticipation")}>
      <SwitchRow checked={item.commentsEnabled} label={t("ui.admin.allowComments")} onChange={(commentsEnabled) => onChange({ commentsEnabled })} />
      <SwitchRow checked={item.supportEnabled} label={t("ui.admin.enableSupport")} onChange={(supportEnabled) => onChange({ supportEnabled })} />
      {item.supportEnabled ? (
        <>
          <NumberRow
            label={t("ui.admin.supportGoal")}
            max={MAX_SUPPORT_COUNT}
            onChange={(next) => onChange({ supportGoal: next || null })}
            value={item.supportGoal ?? undefined}
          />
          <NumberRow
            label={t("ui.admin.supportDays")}
            max={MAX_SUPPORT_COUNT}
            onChange={(next) => onChange({ supportDeadlineDays: next || null })}
            unit={t("admin.unitDays")}
            value={item.supportDeadlineDays ?? undefined}
          />
        </>
      ) : null}
    </ListGroup>
  );
}

/** Author self-service deletion, and removing the category altogether. */
export function ManagementGroup({ authorDeleteLabel, item, locked, onChange, onDelete }: {
  authorDeleteLabel: string;
  item: FacilityCategoryConfig;
  locked: boolean;
  onChange: Patch<FacilityCategoryConfig>;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <ListGroup title={t("admin.categoryManagement")}>
      <SwitchRow
        checked={item.authorDeleteEnabled}
        label={authorDeleteLabel}
        onChange={(authorDeleteEnabled) => onChange({ authorDeleteEnabled })}
      />
      <CategoryDeleteAction disabled={item.isDefault} name={item.label} onDelete={onDelete} persisted={locked} />
    </ListGroup>
  );
}
