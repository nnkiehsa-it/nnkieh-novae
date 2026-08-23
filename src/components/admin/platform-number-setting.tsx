"use client";

import { Input } from "@/components/ui/input";

export function PlatformNumberSetting({
  label,
  max,
  min = 1,
  onChange,
  step = 1,
  value,
}: {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
      <span>{label}</span>
      <Input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="number"
        value={Number.isFinite(value) ? value : ""}
      />
    </label>
  );
}
