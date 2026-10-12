"use client";

import { ArrowsClockwise } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { Button } from "@/ui/button";
import { ListGroup } from "@/ui/list";
import { Sheet } from "@/ui/sheet";
import { FieldRow } from "../shared/rows";
import { useRetained } from "../shared/use-retained";
import type { FailureItem } from "./failures";

/**
 * One piece of stopped work, in full: the message the attempt threw, the
 * identifiers it carries, how often it was tried, and the trace that finds it
 * in the logs. A list row only has room for a name and a line of the refusal.
 */
export function FailureDetailSheet({ busy, item, onClose, onRetry }: {
  busy: boolean;
  item: FailureItem | null;
  onClose: () => void;
  onRetry: (item: FailureItem) => void;
}) {
  const { t } = useI18n();
  const record = useRetained(item);
  if (!record) return null;

  return (
    <Sheet
      description={t("admin.failureDetailTitle")}
      onOpenChange={(open) => { if (!open) onClose(); }}
      open={item !== null}
      title={record.label}
    >
      <div className="grid gap-6">
        <div className="grid gap-2 rounded-tile border border-danger/30 bg-surface-raised px-4 py-3">
          <p className="text-sm text-ink-muted">{t("admin.failureMessage")}</p>
          <p className="font-mono text-sm leading-relaxed text-danger [overflow-wrap:anywhere]">
            {record.message || t("admin.failureMessageMissing")}
          </p>
        </div>
        <ListGroup title={t("admin.failureRecord")}>
          {record.fields.map((field) => (
            <FieldRow key={field.label} label={field.label} mono={field.mono} value={field.value} />
          ))}
        </ListGroup>
        {record.retryable ? (
          <Button onClick={() => onRetry(record)} status={busy ? "loading" : "idle"} variant="secondary">
            <ArrowsClockwise aria-hidden />
            {t("admin.retry")}
          </Button>
        ) : null}
      </div>
    </Sheet>
  );
}
