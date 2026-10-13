"use client";

import * as React from "react";
import { useI18n } from "@/i18n";
import { ErrorState } from "@/ui/page";

/** A read that failed, with the reason it gave and a way to ask again. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useI18n();
  return <ErrorState message={message} onRetry={onRetry} retryLabel={t("common.retry")} title={t("ui.common.loadFailed")} />;
}

/** A refusal or failure from the last action, kept beside the controls that caused it. */
export function InlineAlert({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-sm leading-relaxed text-danger" role="alert">{children}</p>;
}
