import type * as React from "react";
import type { DraftImpact } from "@/hooks/use-draft";
import { useI18n } from "@/i18n";
import type { DraftChange } from "@/lib/draft-diff";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import type { Translate } from "./translate";

function formatValue(value: unknown, t: Translate) {
  if (typeof value === "boolean") return t(value ? "admin.valueOn" : "admin.valueOff");
  if (Array.isArray(value)) return String(value.length);
  if (value === null || value === undefined) return "—";
  return String(value);
}

function positive(counts: Record<string, number> | undefined) {
  return Object.entries(counts ?? {}).filter(([, count]) => count > 0);
}

/** The sentence under the title: how much stored data the change will disturb, or how many settings move. */
function summarize(changeCount: number, impact: DraftImpact | null | undefined, t: Translate) {
  const retention = impact?.totalDeletedRows !== undefined;
  if (retention && impact.totalDeletedRows! > 0) return t("admin.reviewImpactDescription", { count: impact.totalDeletedRows! });
  if (impact && impact.totalEstimatedRows > 0) {
    return t(retention ? "admin.reviewExpiryDescription" : "admin.reviewUpdateDescription", {
      count: impact.totalUpdatedRows ?? impact.totalEstimatedRows,
    });
  }
  return t("admin.reviewDescription", { count: changeCount });
}

function CountList({ describe, entries }: { describe?: (key: string) => React.ReactNode; entries: [string, number][] }) {
  if (entries.length === 0) return null;
  return (
    <ul className="divide-y divide-line rounded-tile bg-surface-raised">
      {entries.map(([key, count]) => (
        <li className="flex items-center gap-3 px-4 py-3" key={key}>
          <span className="min-w-0 flex-1 text-sm">{describe ? describe(key) : key}</span>
          <span className="text-sm font-semibold tabular-nums">{count}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The last thing shown before a change is made. It says what a bare
 * confirmation cannot: which settings are moving, and how much stored data
 * that will disturb. One dialog serves every admin screen.
 */
export function ReviewDialog({ changes, confirmLabel, describeChange, describeImpact, description, formatChangeValue, impact, onCancel, onConfirm, open }: {
  changes: DraftChange[];
  confirmLabel?: string;
  describeChange: (key: string) => React.ReactNode;
  /** Names the stored records an estimate counted, keyed the way the backend reports them. */
  describeImpact?: (key: string) => React.ReactNode;
  description?: React.ReactNode;
  formatChangeValue?: (change: DraftChange, value: unknown) => React.ReactNode;
  impact?: DraftImpact | null;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}) {
  const { t } = useI18n();
  const alsoExpiring = (impact?.totalDeletedRows ?? 0) > 0 && (impact?.totalUpdatedRows ?? 0) > 0;
  return (
    <ConfirmDialog
      confirmLabel={confirmLabel ?? t(impact && impact.totalEstimatedRows > 0 ? "admin.reviewQueue" : "ui.common.save")}
      description={description ?? summarize(changes.length, impact, t)}
      onConfirm={onConfirm}
      onOpenChange={(next) => { if (!next) onCancel(); }}
      open={open}
      title={t("admin.reviewTitle")}
    >
      <div className="grid max-h-[50svh] gap-3 overflow-y-auto">
        <ul className="divide-y divide-line rounded-tile bg-surface-raised">
          {changes.map((change) => (
            <li className="grid gap-1 px-4 py-3" key={change.key}>
              <span className="text-sm">{describeChange(change.key)}</span>
              <span className="break-words text-sm tabular-nums text-ink-muted">
                {formatChangeValue?.(change, change.before) ?? formatValue(change.before, t)}
                <span aria-hidden className="px-1.5">→</span>
                <span className="font-medium text-ink">{formatChangeValue?.(change, change.after) ?? formatValue(change.after, t)}</span>
              </span>
            </li>
          ))}
        </ul>
        {alsoExpiring ? (
          <p className="px-1 text-sm leading-relaxed text-ink-muted">
            {t("admin.reviewExpiryDescription", { count: impact!.totalUpdatedRows! })}
          </p>
        ) : null}
        <CountList describe={describeImpact} entries={positive(impact?.details)} />
        <CountList describe={describeImpact} entries={positive(impact?.updatedDetails)} />
      </div>
    </ConfirmDialog>
  );
}
