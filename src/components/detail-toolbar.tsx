"use client";

import { useRef, type ReactNode } from "react";
import { Icon, Navbar } from "framework7-react";
import { useI18n } from "@/i18n";
import { useShareExitGuard } from "@/hooks/use-share-entry";
import {
  useCloseRouteOverlay,
  useRouteOverlayLabel,
} from "@/components/detail-sheet";
import { ToolbarButton } from "@/components/ui/toolbar-button";
import { useNativeNavbarSize } from "@/components/ui/use-native-navbar";
import { SheetCloseButton } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SecondaryToolbar({
  actions,
  backLabel,
  backDisabled,
  onBack,
}: {
  actions?: ReactNode;
  backLabel: string;
  backDisabled?: boolean;
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
  const navbarRef = useRef<{ el: HTMLElement | null }>({ el: null });
  useNativeNavbarSize(navbarRef, Boolean(closeOverlay));
  if (!closeOverlay)
    return (
      <div className="flex items-center">
        <ToolbarButton
          aria-label={backLabel}
          disabled={backDisabled}
          onClick={() => guardBack(onBack)}
          size="icon"
        >
          <Icon f7="chevron_left" aria-hidden="true" />
        </ToolbarButton>
        {actions}
      </div>
    );
  return (
    <Navbar ref={navbarRef} data-sheet-drag-region="">
      {overlayLabel ? <div slot="title">{overlayLabel}</div> : null}
      <div slot="right" className="flex items-center gap-1">
        {actions}
          <Tooltip>
            <TooltipTrigger asChild>
              <SheetCloseButton />
            </TooltipTrigger>
            <TooltipContent>{t("common.close")}</TooltipContent>
          </Tooltip>
      </div>
    </Navbar>
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
              <ToolbarButton
                aria-label={shareLabel}
                onClick={onShare}
                size="icon"
              >
                <Icon f7="square_arrow_up" aria-hidden="true" />
              </ToolbarButton>
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
