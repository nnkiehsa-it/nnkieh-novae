"use client";
import * as React from "react";
import { ChevronRight, Languages } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { timing } from "@/lib/motion-timing";
import { hasStoredLocale, setLocale, useI18n } from "@/i18n";
import { BrandLockup } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListSection } from "@/components/ui/list";
import { ListChoiceRow } from "@/components/ui/list-controls";

export function AppLocaleGate({ children }: { children: React.ReactNode }) {
  const [gating] = React.useState(() => !hasStoredLocale());
  const [entered, setEntered] = React.useState(false);
  const { locale, t } = useI18n();

  if (!gating) return <>{children}</>;

  return (
    <AnimatePresence initial={false} mode="popLayout">
    {entered ? (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0.85, y: 0 }}
        key="localized-app"
        transition={timing("controlExit")}
      >
        {children}
      </motion.div>
    ) : (
    <motion.main
      animate={{ opacity: 1, scale: 1 }}
      className="grid min-h-[100svh] place-items-center bg-[var(--surface-stage)] p-4"
      exit={{ opacity: 0, scale: 0.985, y: -12 }}
      key="locale-gate"
      transition={timing("sheetExit", "depart")}
    >
      <Card className="t-panel-reveal w-full max-w-lg px-6 py-12 sm:px-10">
        <BrandLockup className="justify-center" />
        <div className="mt-8 text-center">
          <h1 className="text-xl font-semibold">{t("ui.locale.title")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("ui.locale.description")}
          </p>
        </div>
        <ListSection className="mt-6">
          {(
            [
              ["zh-TW", t("ui.locale.zhTraditional")],
              ["en", "English"],
            ] as const
          ).map(([value, label]) => (
            <ListChoiceRow
              key={value}
              onSelect={() => setLocale(value)}
              selected={locale === value}
              label={label}
              icon={Languages}
            />
          ))}
        </ListSection>
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
