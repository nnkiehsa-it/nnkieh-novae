"use client";

import { Block, BlockFooter, BlockTitle } from "framework7-react";
import { useI18n } from "@/i18n";
import { BrandLockup } from "@/components/ui/brand";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function SetupBrand() {
  return <Block className="mx-0 px-0"><BrandLockup /></Block>;
}

export function SetupWaitingState() {
  const { t } = useI18n();
  return <main className="mx-auto max-w-lg text-align-center">
    <Block><BrandLockup className="justify-center" /></Block>
    <BlockTitle large><h1>{t("ui.setup.waitTitle")}</h1></BlockTitle>
    <BlockFooter className="text-align-center">{t("ui.setup.waitDescription")}</BlockFooter>
    <Block>
      <p className="flex items-center justify-center gap-2" role="status"><LoadingSpinner />{t("ui.setup.checking")}</p>
    </Block>
  </main>;
}
