import * as React from "react";
import { ArrowClockwise } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { Button } from "@/ui/button";

/** A glyph-only control that names itself and shows a spinner in the glyph's place while it works. */
export function IconAction({ busy = false, disabled, icon, label, onClick, tone = "default" }: {
  busy?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <Button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      size="icon"
      status={busy ? "loading" : "idle"}
      variant={tone === "danger" ? "danger" : "ghost"}
    >
      {busy ? null : icon}
    </Button>
  );
}

export function RefreshButton({ disabled, loading, onClick }: { disabled?: boolean; loading: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <IconAction
      busy={loading}
      disabled={disabled}
      icon={<ArrowClockwise />}
      label={t("ui.adminConsole.refresh")}
      onClick={onClick}
    />
  );
}
