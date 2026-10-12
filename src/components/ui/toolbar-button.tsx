"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "./toolbar-button.module.css";

/** Shared surface, focus, colour and dimensions for buttons and menu triggers. */
export const toolbarControlClass = styles.control;

export function ToolbarButton({ className, size = "icon", ...props }: Omit<ComponentProps<typeof Button>, "variant">) {
  return <Button {...props} className={cn(toolbarControlClass, className)} size={size} variant="ghost" />;
}
