"use client";

import { Trash2 } from "lucide-react";

import { useI18n } from "@/i18n";
import { CategoryDeleteAction } from "@/components/admin/category-delete-action";
import { ImagePolicyFields } from "@/components/admin/image-policy-fields";
import { SettingPresets } from "@/components/admin/setting-presets";
import { FACILITY_PRESETS, ISSUE_PRESETS } from "@/lib/admin-setting-presets";
import { ListRowGroup, ListSection } from "@/components/ui/list";
import {
  ListChoiceRow,
  ListInputRow,
  ListNumberRow,
  ListSwitchRow,
} from "@/components/ui/list-controls";
import { ListPicker } from "@/components/ui/choice-select";
import type { FacilityCategoryConfig, IssueCategoryConfig } from "@/types/categories";

type AnyCategory = FacilityCategoryConfig | IssueCategoryConfig;

function isIssue(item: AnyCategory): item is IssueCategoryConfig {
  return "readAccess" in item;
}

/**
 * One category, read as a short list of decisions rather than a row of boxes.
 *
 * Issues and facilities used to be two editors that differed only in how much
 * they showed; they are one editor now, and the extra issue decisions simply
 * appear when the category is an issue category. It names nothing: it is opened
 * from a row that already said which category this is.
 */
export function CategoryEditor({
  identifierLocked,
  item,
  onChange,
  onDefault,
  onDelete,
  onRestore,
}: {
  identifierLocked: boolean;
  item: AnyCategory;
  onChange: (item: never) => void;
  onDefault: () => void;
  onDelete: () => void;
  onRestore?: () => void;
}) {
  const { t } = useI18n();
  const change = onChange as (next: AnyCategory) => void;
  const authorDeleteLabel = isIssue(item)
    ? t("ui.admin.allowIssueAuthorDelete")
    : t("ui.admin.allowFacilityAuthorDelete");

  return (
    <div className="space-y-6">
      {isIssue(item) ? (
        <SettingPresets current={item} presets={ISSUE_PRESETS} onRestore={onRestore}
          onApply={(rules) => change({ ...item, ...rules })} />
      ) : (
        <SettingPresets current={item} presets={FACILITY_PRESETS} onRestore={onRestore}
          onApply={(rules) => change({ ...item, ...rules })} />
      )}
    <ListSection header={t("admin.categoryIdentity")}>
      <ListInputRow
        label={t("ui.common.name")}
        onChange={(next) => change({ ...item, label: next })}
        value={item.label}
      />
      <ListInputRow
        disabled={identifierLocked}
        label={t("ui.common.slug")}
        onChange={(next) =>
          change({ ...item, id: next.toLowerCase().replace(/\s+/gu, "-") })
        }
        value={item.id}
      />
      <ListChoiceRow
        label={t("ui.admin.defaultCategory")}
        onSelect={onDefault}
        selected={item.isDefault}
      />
    </ListSection>

      {isIssue(item) ? (
        <ListSection header={t("admin.categoryVisibility")}>
          <ListPicker
            label={t("ui.admin.readAccess")}
            onChange={(next) =>
              change({ ...item, readAccess: next as IssueCategoryConfig["readAccess"], authorVisible: next === "owner-admin" ? true : item.authorVisible })
            }
            options={[
              { label: t("ui.admin.schoolVisible"), value: "school" },
              { label: t("ui.admin.reviewedVisible"), value: "reviewed-school" },
              { label: t("ui.admin.ownerAdminOnly"), value: "owner-admin" },
            ]}
            value={item.readAccess}
          />
          <ListSwitchRow
            checked={item.authorVisible}
            disabled={item.readAccess === "owner-admin"}
            label={t("ui.admin.showAuthor")}
            name={t("ui.admin.showAuthor")}
            onCheckedChange={(next) => change({ ...item, authorVisible: next })}
          />
        </ListSection>
      ) : null}
      {isIssue(item) ? (
        <ListSection header={t("admin.categoryParticipation")}>
          <ListSwitchRow
            checked={item.commentsEnabled}
            label={t("ui.admin.allowComments")}
            name={t("ui.admin.allowComments")}
            onCheckedChange={(next) => change({ ...item, commentsEnabled: next })}
          />
          <ListSwitchRow
            checked={item.supportEnabled}
            label={t("ui.admin.enableSupport")}
            name={t("ui.admin.enableSupport")}
            onCheckedChange={(next) => change({ ...item, supportEnabled: next })}
          />
          <ListRowGroup show={item.supportEnabled}>
            <ListNumberRow
              label={t("ui.admin.supportGoal")}
              onChange={(next) => change({ ...item, supportGoal: next || null })}
              value={item.supportGoal ?? undefined}
            />
            <ListNumberRow
              label={t("ui.admin.supportDays")}
              onChange={(next) => change({ ...item, supportDeadlineDays: next || null })}
              unit={t("admin.unitDays")}
              value={item.supportDeadlineDays ?? undefined}
            />
          </ListRowGroup>
        </ListSection>
      ) : null}

    <ListSection header={t("ui.admin.imageUploads")}>
      <ImagePolicyFields value={item.maxImages} onChange={(next) => change({ ...item, maxImages: next })} />
      {isIssue(item) && item.commentsEnabled ? (
        <ImagePolicyFields comments value={item.commentMaxImages} onChange={(next) => change({ ...item, commentMaxImages: next })} />
      ) : null}
    </ListSection>

    <ListSection header={t("admin.categoryManagement")}>
      <ListSwitchRow
        checked={item.authorDeleteEnabled}
        label={authorDeleteLabel}
        name={authorDeleteLabel}
        onCheckedChange={(next) => change({ ...item, authorDeleteEnabled: next })}
      />
      <CategoryDeleteAction
        disabled={item.isDefault}
        icon={Trash2}
        name={item.label}
        onDelete={onDelete}
        persisted={identifierLocked}
      />
    </ListSection>
    </div>
  );
}
