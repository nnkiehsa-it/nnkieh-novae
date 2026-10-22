import { CaretDown } from "@phosphor-icons/react/ssr";
import { ACCOUNT_ACCESS_DURATION_KEYS, ACCOUNT_ACCESS_PRESET_KEYS } from "@/constants/account-access";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { rowClass } from "@/ui/list";
import { READ_ACCESS_KEYS, isReadAccess } from "../shared/read-access";
import { FieldRow } from "../shared/rows";
import type { Translate } from "../shared/translate";
import { describeSettingKey } from "../platform/setting-fields";
import { CATEGORY_FIELD_LABELS, DETAIL_LABELS, SCOPE_KIND_LABELS, TARGET_TYPE_LABELS } from "./audit-labels";

/** The words a reader would use for a recorded field, wherever in the record it sits. */
function fieldLabel(name: string, path: string, t: Translate) {
  const normalized = path.replace(/^imageSettings\./u, "imageUploads.").replace(/^retentionConfig\./u, "retention.");
  if (normalized.startsWith("values.")) return t(`ui.operations.policy.${name}`);
  if (/^(imageUploads|retention)\./u.test(normalized)) return t(describeSettingKey(normalized));
  const inCategory = /^(issueCategories|facilityCategories)\./u.test(path);
  const key = (inCategory ? CATEGORY_FIELD_LABELS[name] : undefined) ?? DETAIL_LABELS[name] ?? CATEGORY_FIELD_LABELS[name];
  return key ? t(key) : name;
}

/** A recorded value as text, translated where the record stores a code. */
function valueText(name: string, value: unknown, t: Translate) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return t(value ? "ui.common.enabled" : "ui.common.disabled");
  if (typeof value !== "string") return String(value);
  if (name === "scopeKind") return SCOPE_KIND_LABELS[value] ? t(SCOPE_KIND_LABELS[value]) : value;
  if (name === "readAccess") return isReadAccess(value) ? t(READ_ACCESS_KEYS[value]) : value;
  if (name === "targetType") return TARGET_TYPE_LABELS[value] ? t(TARGET_TYPE_LABELS[value]) : value;
  if (name === "preset" && Object.hasOwn(ACCOUNT_ACCESS_PRESET_KEYS, value)) {
    return t(ACCOUNT_ACCESS_PRESET_KEYS[value as keyof typeof ACCOUNT_ACCESS_PRESET_KEYS]);
  }
  if (name === "duration" && Object.hasOwn(ACCOUNT_ACCESS_DURATION_KEYS, value)) {
    return t(ACCOUNT_ACCESS_DURATION_KEYS[value as keyof typeof ACCOUNT_ACCESS_DURATION_KEYS]);
  }
  return value;
}

function AuditField({ name, path, title, value }: { name: string; path: string; title?: string; value: unknown }) {
  const { t } = useI18n();
  const label = title ?? fieldLabel(name, path, t);
  if (value === null || typeof value !== "object") return <FieldRow label={label} value={valueText(name, value, t)} />;

  const fields = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value);
  return (
    <li>
      <details className="group">
        <summary className={cn(rowClass, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
          <span className="min-w-0 flex-1 text-base [overflow-wrap:anywhere]">{label}</span>
          <span className="shrink-0 text-sm text-ink-muted">{t("ui.adminConsole.detailItemCount", { count: fields.length })}</span>
          <CaretDown aria-hidden className="size-4 shrink-0 text-ink-faint transition-transform duration-[var(--motion-control)] group-open:rotate-180" weight="bold" />
        </summary>
        <ul className="ml-4 divide-y divide-line border-l border-line">
          {fields.map(([key, item]) => {
            const record = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
            const itemTitle = Array.isArray(value)
              ? String(record?.label ?? record?.uid ?? t("admin.auditItem", { index: Number(key) + 1 }))
              : undefined;
            return <AuditField key={key} name={key} path={`${path}.${key}`} title={itemTitle} value={item} />;
          })}
        </ul>
      </details>
    </li>
  );
}

/** A recorded action's detail with its structure and actual values kept, explicit nulls included. */
export function AuditDetails({ detail }: { detail: Record<string, unknown> }) {
  return Object.entries(detail).map(([key, value]) => <AuditField key={key} name={key} path={key} value={value} />);
}
