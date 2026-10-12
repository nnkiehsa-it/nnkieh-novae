"use client";

import * as React from "react";
import { CalendarX, Eraser } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";

type ClearKind = "errors" | "schedules";

const COPY = {
  errors: { confirm: "admin.clearErrors", description: "admin.clearErrorsDescription", title: "admin.clearErrorsTitle" },
  schedules: { confirm: "admin.clearSchedules", description: "admin.clearSchedulesDescription", title: "admin.clearSchedulesTitle" },
} as const;

/** The two ways to wipe the system's records, each asking first because neither can be taken back. */
export function ClearActions({ busy, clearing, onClearErrors, onClearSchedules }: {
  busy: boolean;
  clearing: ClearKind | "";
  onClearErrors: () => void;
  onClearSchedules: () => void;
}) {
  const { t } = useI18n();
  const [asked, setAsked] = React.useState<ClearKind | null>(null);
  const copy = COPY[asked ?? "errors"];
  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button disabled={busy} onClick={() => setAsked("schedules")} size="sm" status={clearing === "schedules" ? "loading" : "idle"} variant="danger">
          <CalendarX aria-hidden />
          {t("admin.clearSchedules")}
        </Button>
        <Button disabled={busy} onClick={() => setAsked("errors")} size="sm" status={clearing === "errors" ? "loading" : "idle"} variant="danger">
          <Eraser aria-hidden />
          {t("admin.clearErrors")}
        </Button>
      </div>
      <ConfirmDialog
        confirmLabel={t(copy.confirm)}
        description={t(copy.description)}
        onConfirm={() => {
          setAsked(null);
          if (asked === "errors") onClearErrors();
          else onClearSchedules();
        }}
        onOpenChange={(open) => { if (!open) setAsked(null); }}
        open={asked !== null}
        title={t(copy.title)}
        tone="danger"
      />
    </>
  );
}
