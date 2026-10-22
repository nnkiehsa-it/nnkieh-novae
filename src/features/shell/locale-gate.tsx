import * as React from "react";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { hasStoredLocale, setLocale, useI18n, type AppLocale } from "@/i18n";
import { Button } from "@/ui/button";
import { ListGroup } from "@/ui/list";
import { ChoiceRow } from "@/ui/list-controls";
import { Panel } from "@/ui/panel";
import { BrandLockup } from "./brand";

/** Asks a first-time visitor which language to use before showing anything else. */
export function LocaleGate({ children }: { children: React.ReactNode }) {
  const [asking, setAsking] = React.useState(() => !hasStoredLocale());
  const { locale, t } = useI18n();
  if (!asking) return <>{children}</>;

  const choices: ReadonlyArray<readonly [AppLocale, string]> = [
    ["zh-TW", t("ui.locale.zhTraditional")],
    ["en", "English"],
  ];
  return (
    <main className="grid min-h-svh place-items-center px-[var(--gutter)] py-10">
      <Panel className="grid w-full max-w-md gap-7 p-6 sm:p-8">
        <BrandLockup />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("ui.locale.title")}</h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{t("ui.locale.description")}</p>
        </div>
        <ListGroup role="radiogroup">
          {choices.map(([value, label]) => (
            <ChoiceRow key={value} label={label} onSelect={() => setLocale(value)} selected={locale === value} />
          ))}
        </ListGroup>
        <Button
          className="w-full"
          onClick={() => {
            setLocale(locale);
            setAsking(false);
          }}
          size="lg"
        >
          {t("ui.locale.continue")}
          <ArrowRight weight="bold" />
        </Button>
      </Panel>
    </main>
  );
}
