"use client";

import { LiquidTabs, type LiquidTabOption } from "@/components/ui/liquid-tabs";
import styles from "./feed-navigation.module.css";

/** Keep feed destinations equal in width, independently of the category picker. */
export function FeedNavigation({ label, options, value, onChange }: {
  label: string;
  options: LiquidTabOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <LiquidTabs
      ariaLabel={label}
      className={styles.navigation}
      onValueChange={onChange}
      options={options}
      value={value}
    />
  );
}
