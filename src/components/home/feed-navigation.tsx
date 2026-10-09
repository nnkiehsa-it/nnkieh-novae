"use client";

import { LiquidTabs, type LiquidTabOption } from "@/components/ui/liquid-tabs";

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
      className="w-full [&>.novae-tabs]:w-full md:max-w-md"
      onValueChange={onChange}
      options={options}
      value={value}
    />
  );
}
