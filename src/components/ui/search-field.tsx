"use client";

import { Searchbar } from "framework7-react";
import { useNativeSearchbar } from "./use-native-searchbar";

export function SearchField({ label, value, onChange, disabled, autoFocus, onClear, className }: {
  label: string; value: string; onChange: (value: string) => void;
  disabled?: boolean; autoFocus?: boolean; onClear?: () => void; className?: string;
}) {
  const ref = useNativeSearchbar(label, {disabled, autoFocus});
  return <Searchbar ref={ref as NonNullable<React.ComponentProps<typeof Searchbar>["ref"]>}
    form={false} inline customSearch backdrop={false} disableButton={false}
    placeholder={label} value={value} className={className}
    onInput={(event) => onChange(event.target.value)} onSearchbarClear={onClear} />;
}
