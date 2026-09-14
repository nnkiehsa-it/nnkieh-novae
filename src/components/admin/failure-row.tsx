"use client";

import { motion } from "motion/react";
import { RotateCcw } from "lucide-react";

import { ListMutationRow, RowAction } from "@/components/ui/list";
import type { FailureItem } from "@/components/admin/system-failures";
import { useI18n } from "@/i18n";
import { timing } from "@/lib/motion-timing";

/**
 * One failure as a row: what stopped, what it said, and the one glyph that asks
 * for it again.
 *
 * The row opens the whole record; only the glyph retries. Asking for a retry
 * used to be the entire width of the row, with the word "retry" at its end --
 * which is a label rather than a target -- so a reader who meant to read a
 * failure queued it instead.
 */
export function FailureRow({
  item,
  onOpen,
  onRetry,
  retrying,
}: {
  item: FailureItem;
  onOpen: () => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { t } = useI18n();
  return (
    <motion.div
      animate={{ height: "auto", opacity: 1 }}
      className="overflow-hidden"
      exit={{ height: 0, opacity: 0 }}
      initial={false}
      transition={timing("control")}
    >
      <ListMutationRow
        action={
          item.retryable ? (
            <RowAction
              busy={retrying}
              icon={RotateCcw}
              label={t("admin.retry")}
              onClick={onRetry}
            />
          ) : null
        }
        detail={
          <span className="line-clamp-2 break-words font-mono text-destructive">
            {item.message || t("admin.failureMessageMissing")}
          </span>
        }
        label={item.label}
        onOpen={onOpen}
        openLabel={t("admin.failureOpen")}
      />
    </motion.div>
  );
}
