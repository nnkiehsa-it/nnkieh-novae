"use client";

import { AnimatePresence, motion } from "motion/react";
import { useI18n } from "@/i18n";
import { timing } from "@/lib/motion-timing";
import type { DraftStatus } from "@/types/draft";
import { Button } from "./button";

/**
 * The one place a screen is saved from. It is absent until something has
 * changed, so when it is there something is unsaved, and when it goes the
 * save went through.
 */
export function SaveBar({ changeCount, disabled = false, error, onDiscard, onReload, onReview, onSave, status }: {
  changeCount: number;
  disabled?: boolean;
  error?: string;
  onDiscard: () => void;
  /** Reloads the server's copy after a conflicting save. */
  onReload?: () => void;
  /** Opens a before-and-after list of the changes. */
  onReview?: () => void;
  onSave: () => void;
  status: DraftStatus;
}) {
  const { t } = useI18n();
  const saving = status === "saving";
  const saved = status === "saved";
  const present = changeCount > 0 || saving || saved;
  const hidden = { opacity: 0, y: "120%" };
  return (
    <AnimatePresence initial={false}>
      {present ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          aria-live="polite"
          className="glass sticky bottom-[calc(var(--bottom-nav-height)+var(--bottom-nav-gap)+0.75rem)] z-30 flex flex-wrap items-center gap-2 rounded-panel p-3 pl-5 shadow-float md:bottom-4"
          exit={hidden}
          initial={hidden}
          role="status"
          transition={timing("sheet")}
        >
          {error ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <p className="flex-1 text-sm text-danger" role="alert">{error}</p>
              {onReload ? <Button disabled={saving} onClick={onReload} size="sm">{t("admin.reloadSettings")}</Button> : null}
            </div>
          ) : null}
          <span className="min-w-28 flex-1 text-sm text-ink-muted">
            {saved ? t("ui.common.saveBarSaved") : t("ui.common.saveBarPending", { count: changeCount })}
          </span>
          {onReview && !saving && !saved ? <Button onClick={onReview} size="sm" variant="ghost">{t("ui.common.saveBarReview")}</Button> : null}
          <Button disabled={saving || saved} onClick={onDiscard} size="sm">{t("ui.common.saveBarDiscard")}</Button>
          <Button
            disabled={disabled}
            onClick={onSave}
            size="sm"
            status={saving ? "loading" : saved ? "success" : "idle"}
            variant="primary"
          >
            {t("ui.common.save")}
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
