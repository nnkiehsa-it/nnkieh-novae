"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
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
  return (
    <div className="flex h-9 items-center justify-between gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={backLabel}
            className="size-11 md:size-9"
            onClick={onBack}
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
