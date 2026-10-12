"use client";

import { useI18n } from "@/i18n";
import { LoadingList, PageHeader } from "@/ui/page";

export default function Loading() {
  const { t } = useI18n();
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <PageHeader title={t("ui.nav.notifications")} />
      <LoadingList label={t("common.loading")} rows={5} />
    </div>
  );
}
