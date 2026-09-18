"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { useShareExitGuard } from "@/hooks/use-share-entry";
import { useCloseRouteOverlay, useRouteOverlayLabel } from "@/components/detail-sheet";
import { Button } from "@/components/ui/button";
import { SheetCloseButton } from "@/components/ui/sheet";
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
  const closeOverlay = useCloseRouteOverlay();
  const overlayLabel = useRouteOverlayLabel();
  const { t } = useI18n();
  return (
    <div
      className="flex h-9 items-center justify-between gap-3"
      data-sheet-drag-region=""
    >
      {!closeOverlay ? <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={backLabel}
            className="size-11 md:size-9"
            onClick={() => guardBack(onBack)}
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
        {closeOverlay ? <Tooltip>
          <TooltipTrigger asChild>
            <SheetCloseButton />
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
