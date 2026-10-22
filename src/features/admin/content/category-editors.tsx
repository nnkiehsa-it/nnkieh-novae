import { useI18n } from "@/i18n";
import { FACILITY_PRESETS, ISSUE_PRESETS } from "@/lib/admin-setting-presets";
import type { FacilityCategoryConfig, IssueCategoryConfig } from "@/types/categories";
import { ListGroup } from "@/ui/list";
import { SettingPresets } from "../shared/setting-presets";
import { IdentityGroups, ManagementGroup, ParticipationGroup, VisibilityGroup } from "./category-groups";
import { ImagePolicyRows } from "./image-policy-rows";

interface EditorProps<Config> {
  item: Config;
  /** Whether the backend already holds this category, which fixes its identifier. */
  locked: boolean;
  onChange: (next: Config) => void;
  onDefault: () => void;
  onDelete: () => void;
  /** Absent for a category that has no saved version to return to. */
  onRestore?: () => void;
}

/**
 * One proposal category as a short list of decisions. It names nothing: it is
 * opened from a row that already said which category this is.
 */
export function IssueCategoryEditor({ item, locked, onChange, onDefault, onDelete, onRestore }: EditorProps<IssueCategoryConfig>) {
  const { t } = useI18n();
  const patch = (changes: Partial<IssueCategoryConfig>) => onChange({ ...item, ...changes });
  const presets = locked
    ? ISSUE_PRESETS.filter((preset) => preset.values.readAccess === item.readAccess && preset.values.authorVisible === item.authorVisible)
    : ISSUE_PRESETS;
  return (
    <div className="grid gap-6">
      <SettingPresets current={item} onApply={patch} onRestore={onRestore} presets={presets} />
      <IdentityGroups item={item} locked={locked} onChange={patch} onDefault={onDefault} />
      <VisibilityGroup item={item} locked={locked} onChange={patch} />
      <ParticipationGroup item={item} onChange={patch} />
      <ListGroup footer={t("admin.imagePolicyHelp")} title={t("ui.admin.imageUploads")}>
        <ImagePolicyRows onChange={(maxImages) => patch({ maxImages })} value={item.maxImages} />
        {item.commentsEnabled ? (
          <ImagePolicyRows comments onChange={(commentMaxImages) => patch({ commentMaxImages })} value={item.commentMaxImages} />
        ) : null}
      </ListGroup>
      <ManagementGroup
        authorDeleteLabel={t("ui.admin.allowIssueAuthorDelete")}
        item={item}
        locked={locked}
        onChange={patch}
        onDelete={onDelete}
      />
    </div>
  );
}

/** One facility category: the same decisions as a proposal category, minus the ones that only apply to proposals. */
export function FacilityCategoryEditor({ item, locked, onChange, onDefault, onDelete, onRestore }: EditorProps<FacilityCategoryConfig>) {
  const { t } = useI18n();
  const patch = (changes: Partial<FacilityCategoryConfig>) => onChange({ ...item, ...changes });
  return (
    <div className="grid gap-6">
      <SettingPresets current={item} onApply={patch} onRestore={onRestore} presets={FACILITY_PRESETS} />
      <IdentityGroups item={item} locked={locked} onChange={patch} onDefault={onDefault} />
      <ListGroup footer={t("admin.imagePolicyHelp")} title={t("ui.admin.imageUploads")}>
        <ImagePolicyRows onChange={(maxImages) => patch({ maxImages })} value={item.maxImages} />
      </ListGroup>
      <ManagementGroup
        authorDeleteLabel={t("ui.admin.allowFacilityAuthorDelete")}
        item={item}
        locked={locked}
        onChange={patch}
        onDelete={onDelete}
      />
    </div>
  );
}
