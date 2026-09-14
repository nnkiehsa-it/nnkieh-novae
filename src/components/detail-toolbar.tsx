"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import { useShareExitGuard } from "@/hooks/use-share-entry";
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
  return (
    <div className="flex h-9 items-center justify-between gap-3">
      <Tooltip>
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
      </Tooltip>
      <div className="flex items-center gap-1">{actions}</div>
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
