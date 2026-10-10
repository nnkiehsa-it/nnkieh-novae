"use client";

import { useState, type ReactNode } from "react";
import { Block, BlockFooter, LoginScreenTitle, Page, PageContent } from "framework7-react";
import { hasStoredLocale, setLocale, useI18n } from "@/i18n";
import { BrandLockup } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { ListSection } from "@/components/ui/list";
import { ListChoiceRow } from "@/components/ui/list-controls";

export function AppLocaleGate({ children }: { children: ReactNode }) {
  const [gating] = useState(() => !hasStoredLocale());
  const [entered, setEntered] = useState(false);
  const { locale, t } = useI18n();
  if (!gating || entered) return children;

  return <Page loginScreen noNavbar noToolbar pageContent={false} className="novae-page">
    <PageContent loginScreen>
      <main>
      <Block><BrandLockup className="justify-center" /></Block>
      <LoginScreenTitle><h1>{t("ui.locale.title")}</h1></LoginScreenTitle>
      <BlockFooter className="text-align-center">{t("ui.locale.description")}</BlockFooter>
      <Block>
        <ListSection>
          {([["zh-TW", t("ui.locale.zhTraditional")], ["en", "English"]] as const).map(([value, label]) => (
            <ListChoiceRow key={value} onSelect={() => setLocale(value)} selected={locale === value} label={label} />
          ))}
        </ListSection>
      </Block>
      <Block>
        <Button className="w-full" size="lg" onClick={() => { setLocale(locale); setEntered(true); }}>
          {t("ui.locale.continue")}
        </Button>
      </Block>
      </main>
    </PageContent>
  </Page>;
}
