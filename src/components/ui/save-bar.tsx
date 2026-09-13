"use client";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { Button } from "@/components/ui/button";
import type { DraftStatus } from "@/types/draft";
import { cn } from "@/lib/utils";

/**
 * The one place a screen is saved from.
 *
 * It is absent until something has actually been changed, which is what makes
 * it trustworthy: when it is there, there is something unsaved, and when it is
 * gone, there is not. A screen has exactly one of these, so "save" never has to
 * mean "save which part".
 */
export function SaveBar({
  changeCount,
  className,
  disabled = false,
  onDiscard,
  onReview,
  onSave,
  status,
}: {
  changeCount: number;
  className?: string;
  disabled?: boolean;
  onDiscard: () => void;
  /** Opens the before-and-after list, where there is one worth reading. */
  onReview?: () => void;
  onSave: () => void;
  status: DraftStatus;
}) {
  useLocaleSubscription();
  const saving = status === "saving";
  const saved = status === "saved";
  if (changeCount === 0 && !saving && !saved) return null;
  return (
    <div
      aria-live="polite"
      className={cn(
        "t-save-bar surface-floating sticky bottom-[calc(var(--mobile-nav-height)+var(--mobile-nav-bottom-gap)+max(0.75rem,var(--safe-bottom)))] z-30 flex flex-wrap items-center gap-2 px-4 py-3 md:bottom-4",
        className,
      )}
      role="status"
    >
      <span className="min-w-0 flex-1 text-sm">
        {saved
          ? translate("ui.common.saveBarSaved")
          : translate("ui.common.saveBarPending", { count: changeCount })}
      </span>
      {onReview && !saving && !saved ? (
        <Button onClick={onReview} size="sm" variant="ghost">
          {translate("ui.common.saveBarReview")}
        </Button>
      ) : null}
      <Button disabled={saving || saved} onClick={onDiscard} size="sm" variant="secondary">
        {translate("ui.common.saveBarDiscard")}
      </Button>
      <Button disabled={disabled || saving || saved} onClick={onSave} size="sm">
        {saving || saved ? (
          <ActionFeedbackIcon
            className="bg-transparent [&>svg]:size-4"
            size="sm"
            state={saved ? "success" : "loading"}
          />
        ) : null}
        {translate("ui.common.save")}
      </Button>
    </div>
  );
}
