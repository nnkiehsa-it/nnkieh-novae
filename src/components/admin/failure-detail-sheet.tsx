"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { FailureItem } from "@/components/admin/system-failures";
import { useI18n } from "@/i18n";

/**
 * One piece of stopped work, in full.
 *
 * A list row holds a name and a line of the refusal; the rest of it is here --
 * the message the attempt threw, the identifiers it carries, how often it has
 * been tried, and the trace that finds it in the logs. Until this existed,
 * "needs attention" was the whole account the screen could give of a failure,
 * and reading further meant querying the database by hand.
 */
export function FailureDetailSheet({
  busy,
  item,
  onClose,
  onRetry,
}: {
  busy: boolean;
  item: FailureItem | null;
  onClose: () => void;
  onRetry: (item: FailureItem) => void;
}) {
  const { t } = useI18n();
  const [shown, setShown] = React.useState<FailureItem | null>(item);
  if (item && item !== shown) setShown(item);
  const record = item ?? shown;
  if (!record) return null;

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(item)}>
      <DialogContent className="sm:max-w-xl" presentation="sheet">
        <DialogHeader>
          <DialogTitle>{record.label}</DialogTitle>
          <DialogDescription>{t("admin.failureDetailTitle")}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
            {t("admin.failureMessage")}
          </p>
          <p className="mt-2 break-words font-mono text-[0.8125rem] leading-6 text-destructive">
            {record.message || t("admin.failureMessageMissing")}
          </p>
        </div>
        <ListSection header={t("admin.failureRecord")}>
          {record.fields.map((field) => (
            <ListRow
              // An identifier is longer than the room a value has at the end of
              // a row, and it cannot be broken at a word, so it is read on its
              // own line underneath instead of pushing the row off the screen.
              detail={
                field.mono ? (
                  <span className="break-all font-mono">{field.value}</span>
                ) : undefined
              }
              key={field.label}
              label={field.label}
              value={field.mono ? undefined : field.value}
            />
          ))}
        </ListSection>
        {record.retryable ? (
          <Button disabled={busy} onClick={() => onRetry(record)} variant="outline">
            {busy ? <LoadingSpinner /> : <RotateCcw aria-hidden />}
            {t("admin.retry")}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
