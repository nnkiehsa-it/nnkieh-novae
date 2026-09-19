"use client";

import { Trash2 } from "lucide-react";

import { useI18n } from "@/i18n";
import { CategoryDeleteAction } from "@/components/admin/category-delete-action";
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
}: {
  identifierLocked: boolean;
  item: AnyCategory;
  onChange: (item: never) => void;
  onDefault: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const change = onChange as (next: AnyCategory) => void;
  const authorDeleteLabel = isIssue(item)
    ? t("ui.admin.allowIssueAuthorDelete")
    : t("ui.admin.allowFacilityAuthorDelete");

  return (
    <ListSection>
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
      <ListSwitchRow
        checked={item.authorDeleteEnabled}
        label={authorDeleteLabel}
        name={authorDeleteLabel}
        onCheckedChange={(next) => change({ ...item, authorDeleteEnabled: next })}
      />

      {isIssue(item) ? (
        <>
          <ListPicker
            label={t("ui.admin.readAccess")}
            onChange={(next) =>
              change({ ...item, readAccess: next as IssueCategoryConfig["readAccess"] })
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
            label={t("ui.admin.showAuthor")}
            name={t("ui.admin.showAuthor")}
            onCheckedChange={(next) => change({ ...item, authorVisible: next })}
          />
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
        </>
      ) : null}

      <CategoryDeleteAction
        disabled={item.isDefault}
        icon={Trash2}
        name={item.label}
        onDelete={onDelete}
        persisted={identifierLocked}
      />
    </ListSection>
  );
}
