"use client";

import { ChevronDown } from "lucide-react";
import { useI18n } from "@/i18n";
import { ACCOUNT_ACCESS_DURATION_KEYS, ACCOUNT_ACCESS_PRESET_KEYS } from "@/constants/account-access";
import { describeSettingKey } from "@/components/admin/platform-setting-fields";
import { ListCustomRow, RowInner, rowClass } from "@/components/ui/list";

const CATEGORY_FIELDS: Record<string, string> = {
  label: "ui.common.name", id: "ui.common.slug", readAccess: "ui.admin.readAccess",
  authorVisible: "ui.admin.showAuthor", authorDeleteEnabled: "admin.auditAuthorDelete",
  commentsEnabled: "ui.admin.allowComments", supportEnabled: "ui.admin.enableSupport",
  supportGoal: "ui.admin.supportGoal", supportDeadlineDays: "ui.admin.supportDays",
  maxImages: "admin.contentImageLimit", commentMaxImages: "ui.admin.commentImageLimit",
  isDefault: "ui.admin.defaultCategory", sortOrder: "admin.categoryOrder",
};

/** Audit JSON keeps its structure and actual values, including explicit nulls. */
export function AuditDetails({ detail, labels }: { detail: Record<string, unknown>; labels: Record<string, string> }) {
  return Object.entries(detail).map(([key, value]) => <AuditField key={key} name={key} path={key} value={value} labels={labels} />);
}

function AuditField({ name, path, value, labels, title }: {
  name: string; path: string; value: unknown; labels: Record<string, string>; title?: string;
}) {
  const { t } = useI18n();
  const normalized = path.replace(/^imageSettings\./u, "imageUploads.").replace(/^retentionConfig\./u, "retention.");
  const label = title ?? (normalized.startsWith("values.") ? t(`ui.operations.policy.${name}`)
    : /^(imageUploads|retention)\./u.test(normalized) ? t(describeSettingKey(normalized))
    : /^(issueCategories|facilityCategories)\./u.test(path) && CATEGORY_FIELDS[name] ? t(CATEGORY_FIELDS[name])
    : labels[name] ? t(labels[name]) : CATEGORY_FIELDS[name] ? t(CATEGORY_FIELDS[name]) : name);
  const complex = value !== null && typeof value === "object";
  if (complex) {
    const fields = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value);
    return <details className="group/audit">
      <summary className={`${rowClass} list-none cursor-pointer`}>
        <RowInner label={<span className="break-words">{label}</span>}
          value={t("ui.adminConsole.detailItemCount", { count: fields.length })}
          trailing={<ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open/audit:rotate-180" />} />
      </summary>
      <div className="ml-4">
        {fields.map(([key, item]) => {
          const record = item && typeof item === "object" ? item as Record<string, unknown> : null;
          const itemTitle = Array.isArray(value) ? String(record?.label ?? record?.uid ?? t("admin.auditItem", { index: Number(key) + 1 })) : undefined;
          return <AuditField key={key} name={key} path={`${path}.${key}`} value={item} labels={labels} title={itemTitle} />;
        })}
      </div>
    </details>;
  }
  let shown = value === null || value === undefined || value === "" ? "—" : String(value);
  if (typeof value === "boolean") shown = t(value ? "ui.common.enabled" : "ui.common.disabled");
  if (name === "scopeKind" && typeof value === "string") {
    const keys: Record<string, string> = { issue: "ui.access.issueCategory", facility: "ui.access.facilityCategory", announcement: "ui.access.announcementManagement" };
    shown = keys[value] ? t(keys[value]) : value;
  }
  if (name === "readAccess" && typeof value === "string") {
    const keys: Record<string, string> = { school: "ui.admin.schoolVisible", "reviewed-school": "ui.admin.reviewedVisible", "owner-admin": "ui.admin.ownerAdminOnly" };
    shown = keys[value] ? t(keys[value]) : value;
  }
  if (name === "preset" && typeof value === "string" && value in ACCOUNT_ACCESS_PRESET_KEYS) {
    shown = t(ACCOUNT_ACCESS_PRESET_KEYS[value as keyof typeof ACCOUNT_ACCESS_PRESET_KEYS]);
  }
  if (name === "duration" && typeof value === "string" && value in ACCOUNT_ACCESS_DURATION_KEYS) {
    shown = t(ACCOUNT_ACCESS_DURATION_KEYS[value as keyof typeof ACCOUNT_ACCESS_DURATION_KEYS]);
  }
  if (name === "targetType") {
    if (value === "uid") shown = t("ui.accountAccess.source.uid");
    if (value === "email_prefix") shown = t("ui.accountAccess.prefixLabel");
  }
  return <ListCustomRow className="flex-col items-stretch gap-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="break-words text-sm [overflow-wrap:anywhere]">{shown}</span>
  </ListCustomRow>;
}
