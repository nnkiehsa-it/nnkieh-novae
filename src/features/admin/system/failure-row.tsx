"use client";

import { ArrowsClockwise } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { ListRow } from "@/ui/list";
import { IconAction } from "../shared/icon-actions";
import { ActionableRow } from "../shared/rows";
import type { FailureItem } from "./failures";

/**
 * One failure as a row: what stopped and what it said. The row opens the
 * whole record; only the glyph retries, so a tap meant to read a failure
 * cannot queue it again.
 */
export function FailureRow({ disabled, item, onOpen, onRetry, retrying = false }: {
  disabled?: boolean;
  item: FailureItem;
  onOpen: () => void;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { t } = useI18n();
  const detail = <span className="font-mono text-danger">{item.message || t("admin.failureMessageMissing")}</span>;
  if (!item.retryable || !onRetry) return <ListRow detail={detail} label={item.label} onClick={onOpen} />;
  return (
    <ActionableRow
      action={<IconAction busy={retrying} disabled={disabled} icon={<ArrowsClockwise />} label={t("admin.retry")} onClick={onRetry} />}
      detail={detail}
      label={item.label}
      onClick={onOpen}
    />
  );
}
