"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Share2, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { useShareExitGuard } from "@/hooks/use-share-entry";
import { useCloseRecord, useRecordOverlayLabel } from "@/components/detail-modal";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SecondaryToolbar({
  actions,
  backLabel,
  onBack,
}: {
  actions?: ReactNode;
  backLabel: string;
  onBack: () => void;
}) {
  // A reader who arrived on a shared link is leaving the one page they were
  // sent, so this is where Novae finally asks how they want to carry on.
  const guardBack = useShareExitGuard();
  // A record shown over the list it came from is put away rather than left, so
  // that it travels back off the screen instead of being cut off by the route
  // changing underneath it. It is the same step back through history either way.
  const closeRecord = useCloseRecord();
  const overlayLabel = useRecordOverlayLabel();
  const { t } = useI18n();
  return (
    <div
      className="t-sheet-drag-region flex h-9 items-center justify-between gap-3"
      data-sheet-drag-region=""
    >
      {!closeRecord ? <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={backLabel}
            className="size-11 md:size-9"
            onClick={() => guardBack(closeRecord ?? onBack)}
            size="icon"
            variant="ghost"
          >
            <ArrowLeft />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{backLabel}</TooltipContent>
      </Tooltip> : null}
      {overlayLabel ? <span className="min-w-0 flex-1 truncate text-left text-lg leading-none font-semibold">{overlayLabel}</span> : null}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {actions}
        {closeRecord ? <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={t("common.close")}
              className="size-11 md:size-9"
              data-slot="dialog-close"
              onClick={closeRecord}
              size="icon"
              variant="ghost"
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("common.close")}</TooltipContent>
        </Tooltip> : null}
      </div>
    </div>
  );
}

export function DetailToolbar({
  actions,
  backLabel,
  onBack,
  onShare,
  shareLabel,
}: {
  actions?: ReactNode;
  backLabel: string;
  onBack: () => void;
  onShare: () => void;
  shareLabel: string;
}) {
  return (
    <SecondaryToolbar
      actions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={shareLabel}
                className="size-11 md:size-9"
                onClick={onShare}
                size="icon"
                variant="ghost"
              >
                <Share2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{shareLabel}</TooltipContent>
          </Tooltip>
          {actions}
        </>
      }
      backLabel={backLabel}
      onBack={onBack}
    />
  );
}
