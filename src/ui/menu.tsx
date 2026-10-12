"use client";

import * as React from "react";
import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";
import { ListGroup, ListRow } from "./list";
import { Sheet } from "./sheet";
import { useCompactViewport } from "./use-compact-viewport";

export interface MenuItem {
  href?: string;
  icon: Icon;
  key: string;
  label: string;
  onSelect?: () => void;
  tone?: "default" | "danger";
}

const itemClass =
  "flex h-11 cursor-pointer items-center gap-3 rounded-tile px-3 text-[0.9375rem] text-ink outline-none data-[highlighted]:bg-surface-raised [&_svg]:size-5 [&_svg]:text-ink-muted";

/**
 * The few things that can be done here: a menu hung off the trigger on a
 * pointer screen, a sheet of full-width rows on a phone.
 */
export function Menu({
  align = "end",
  description,
  items,
  title,
  trigger,
}: {
  align?: "center" | "end" | "start";
  /** A second line naming the menu, such as an account's address. */
  description?: string;
  items: readonly MenuItem[];
  title: string;
  trigger: React.ReactElement<{ onClick?: () => void }>;
}) {
  const compact = useCompactViewport();
  const [open, setOpen] = React.useState(false);

  if (compact) {
    return (
      <>
        {React.cloneElement(trigger, { onClick: () => setOpen(true) })}
        <Sheet description={description} onOpenChange={setOpen} open={open} title={title}>
          <ListGroup>
            {items.map(({ href, icon: ItemIcon, key, label, onSelect, tone }) =>
              href ? (
                <ListRow href={href} icon={<ItemIcon />} key={key} label={label} onClick={() => setOpen(false)} tone={tone} />
              ) : (
                <ListRow
                  icon={<ItemIcon />}
                  key={key}
                  label={label}
                  onClick={() => { setOpen(false); onSelect?.(); }}
                  tone={tone}
                />
              ),
            )}
          </ListGroup>
        </Sheet>
      </>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          className="z-50 min-w-56 rounded-panel border border-line bg-surface-solid p-1.5 text-ink shadow-float"
          sideOffset={8}
        >
          {description ? (
            <DropdownMenu.Label className="px-3 pb-2 pt-1.5">
              <span className="block truncate text-sm font-medium">{title}</span>
              <span className="block truncate text-xs text-ink-muted">{description}</span>
            </DropdownMenu.Label>
          ) : null}
          {items.map(({ href, icon: ItemIcon, key, label, onSelect, tone }) => {
            const content = <><ItemIcon aria-hidden className={cn(tone === "danger" && "!text-danger")} />{label}</>;
            const className = cn(itemClass, tone === "danger" && "text-danger");
            return href ? (
              <DropdownMenu.Item asChild className={className} key={key}>
                <Link href={href}>{content}</Link>
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item className={className} key={key} onSelect={onSelect}>{content}</DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
