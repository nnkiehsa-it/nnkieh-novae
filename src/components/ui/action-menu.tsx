"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { ModalRoot, ModalTrigger } from "./modal-context";
import { ActionSheet } from "./action-sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompactViewport } from "./use-compact-viewport";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  /** Where it leads, for the ones that lead somewhere rather than act. */
  href?: string;
  icon: LucideIcon;
  key: string;
  label: string;
  onSelect?: () => void;
  tone?: "default" | "destructive";
}

/**
 * The few things that can be done here, asked in the shape the screen calls for.
 *
 * A menu hung off a control is a pointer's idea of a list of actions. On a
 * phone the same actions are a sheet from the bottom edge, where each one is a
 * whole row rather than a line of text the size of a mouse target -- and where
 * a destructive one is far enough from the rest to be chosen on purpose.
 */
export function ActionMenu({
  align = "end",
  className,
  description,
  items,
  title,
  tooltip,
  trigger,
}: {
  align?: "center" | "end" | "start";
  className?: string;
  /** The second line the sheet names itself with, such as an account's address. */
  description?: string;
  items: readonly ActionMenuItem[];
  title: string;
  /** What the control says on a pointer, where a glyph alone does not say it. */
  tooltip?: string;
  trigger: React.ReactElement<{ onClick?: () => void }>;
}) {
  const compact = useCompactViewport();
  const described = (element: React.ReactElement) =>
    tooltip ? (
      <Tooltip>
        <TooltipTrigger asChild>{element}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    ) : (
      element
    );

  if (!compact)
    return (
      <DropdownMenu>
        {described(
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>,
        )}
        <DropdownMenuContent align={align} className={className}>
          {description ? (
            <>
              <DropdownMenuLabel className="font-normal">
                <span className="display-block truncate text-sm font-medium">
                  {title}
                </span>
                <span className="display-block truncate text-xs text-muted-foreground">
                  {description}
                </span>
              </DropdownMenuLabel>
            </>
          ) : null}
          {items.map((item) =>
              <DropdownMenuItem
                className={cn(
                  item.tone === "destructive" && "text-destructive",
                )}
                key={item.key}
                href={item.href}
                icon={item.icon}
                onSelect={item.onSelect}
              >
                {item.label}
              </DropdownMenuItem>
            ,
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );

  return (
    <>
      <ModalRoot>
        {described(<ModalTrigger asChild>{trigger}</ModalTrigger>)}
        <ActionSheet title={title} description={description} items={items} />
      </ModalRoot>
    </>
  );
}
