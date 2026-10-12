"use client";

import { useI18n } from "@/i18n";
import { LoadingList } from "@/ui/page";

/** What any administration route shows while it arrives, under the shell that is already there. */
export function AdminLoading() {
  const { t } = useI18n();
  return <LoadingList label={t("common.loading")} rows={4} />;
}
