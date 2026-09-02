"use client";
import * as React from "react";
import { Check, ChevronRight, Languages } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { hasStoredLocale, setLocale, useI18n } from "@/i18n";
import { BrandLockup } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AppLocaleGate({ children }: { children: React.ReactNode }) {
  const [gating] = React.useState(() => !hasStoredLocale());
  const [entered, setEntered] = React.useState(false);
  const { locale, t } = useI18n();

  if (!gating) return <>{children}</>;

  return (
    <AnimatePresence initial={false} mode="wait">
    {entered ? (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 16 }}
        key="localized-app"
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    ) : (
    <motion.main
      animate={{ opacity: 1, scale: 1 }}
      className="grid min-h-[100svh] place-items-center bg-[var(--surface-stage)] p-4"
      exit={{ opacity: 0, scale: 0.985, y: -12 }}
      key="locale-gate"
      transition={{ duration: 0.32, ease: [0.4, 0, 1, 1] }}
    >
      <Card className="t-panel-reveal w-full max-w-lg px-6 py-12 sm:px-10">
        <BrandLockup className="justify-center" />
        <div className="mt-8 text-center">
          <h1 className="text-xl font-semibold">{t("ui.locale.title")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("ui.locale.description")}
          </p>
        </div>
        <div className="mt-6 grid gap-3">
          {(
            [
              ["zh-TW", t("ui.locale.zhTraditional")],
              ["en", "English"],
            ] as const
          ).map(([value, label]) => (
            <button
              className="t-card flex min-h-16 items-center gap-4 rounded-xl border bg-card px-5 text-left shadow-[var(--shadow-card)]"
              key={value}
              onClick={() => setLocale(value)}
              type="button"
            >
              <span className="grid size-8 place-items-center rounded-lg bg-muted">
                <Languages className="size-4" />
              </span>
              <span className="flex-1 font-medium">{label}</span>
              <AnimatePresence>
              {locale === value ? (
                <motion.span
                  animate={{ opacity: 1, scale: 1 }}
                  className="t-success-check grid size-6 place-items-center rounded-full bg-foreground text-background"
                  data-state="in"
                  exit={{ opacity: 0, scale: 0.6 }}
                  initial={{ opacity: 0, scale: 0.6 }}
                  key="selected"
                >
                  <Check className="size-3.5" />
                </motion.span>
              ) : null}
              </AnimatePresence>
            </button>
          ))}
        </div>
        <div className="mt-8 flex justify-end">
          <Button
            onClick={() => {
              setLocale(locale);
              setEntered(true);
            }}
          >
            {t("ui.locale.continue")}
            <ChevronRight />
          </Button>
        </div>
      </Card>
    </motion.main>
    )}
    </AnimatePresence>
  );
}
