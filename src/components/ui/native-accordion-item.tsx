"use client";

import { useState, type ReactNode } from "react";
import { AccordionContent, ListItem } from "framework7-react";
import { useFramework7ListControl } from "./use-framework7-control";

export function NativeAccordionItem({ children, defaultOpen = false, label, value }: {
  children: ReactNode; defaultOpen?: boolean; label: string; value?: string | number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useFramework7ListControl({ role: "button", tabindex: 0, "aria-label": label, "aria-expanded": String(open) });
  return <ListItem id={id} accordionItem accordionItemOpened={open} title={label} after={value}
    onAccordionOpen={() => setOpen(true)} onAccordionClose={() => setOpen(false)}>
    <AccordionContent>{children}</AccordionContent>
  </ListItem>;
}
