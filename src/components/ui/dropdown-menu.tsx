"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { List, ListItem } from "framework7-react";
import type { LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { useModal } from "./modal-context";
import { useFramework7ListControl } from "./use-framework7-control";

export const DropdownMenu = Popover;
export const DropdownMenuTrigger = PopoverTrigger;
export function DropdownMenuContent({ children, onKeyDown, ...props }: React.ComponentProps<typeof PopoverContent>) {
  return <PopoverContent {...props} role="menu" data-slot="dropdown-menu-content"
    onKeyDown={(event) => {
      onKeyDown?.(event);
      const entries = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
      const current = entries.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "ArrowDown" ? (current + 1) % entries.length
        : event.key === "ArrowUp" ? (current + entries.length - 1) % entries.length
        : event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : null;
      if (next === null || !entries.length) return;
      event.preventDefault();
      entries[next].focus();
    }}>
    <List noChevron dividers className="m-0"><ul>{children}</ul></List>
  </PopoverContent>;
}

export function DropdownMenuItem({ children, href, icon: Icon, onSelect, className }: {
  children: ReactNode; href?: string; icon?: LucideIcon;
  onSelect?: (event: Event) => void; className?: string;
}) {
  const router = useRouter();
  const state = useModal();
  const id = useFramework7ListControl({ role: "menuitem" });
  return <ListItem link={href ?? "#"} noChevron
    id={id}
    onClick={(event: React.MouseEvent) => {
      if (href && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
      event.preventDefault();
      const select = new Event("select", { cancelable: true });
      onSelect?.(select);
      if (!select.defaultPrevented) {
        state.requestClose();
        if (href) router.push(href);
      }
    }}>
    {Icon ? <Icon slot="media" className="size-5" /> : null}
    <span slot="title" className={className}>{children}</span>
  </ListItem>;
}

export function DropdownMenuLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <ListItem><div slot="inner" className={className}>{children}</div></ListItem>;
}
