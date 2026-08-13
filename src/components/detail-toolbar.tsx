"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
    <div className="flex h-9 items-center justify-between gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button aria-label={backLabel} onClick={onBack} size="icon" variant="ghost">
            <ArrowLeft />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{backLabel}</TooltipContent>
      </Tooltip>
      <div className="flex items-center gap-1">
        <Button aria-label={shareLabel} onClick={onShare} size="icon" variant="ghost">
          <Share2 />
        </Button>
        {actions}
      </div>
    </div>
  );
}
