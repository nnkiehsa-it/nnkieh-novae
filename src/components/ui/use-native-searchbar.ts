"use client";

import {useLayoutEffect} from "react";
import {useI18n} from "@/i18n";
import {applyNativeControlAttributes, useFramework7Control} from "./use-framework7-control";

export function useNativeSearchbar(label: string, {enabled = true, disabled, autoFocus, expandable = false}: {
  enabled?: boolean; disabled?: boolean; autoFocus?: boolean; expandable?: boolean;
} = {}) {
  const {t} = useI18n();
  const ref = useFramework7Control<HTMLInputElement>(undefined, "input", {
    "aria-label": label, disabled, autofocus: autoFocus,
  }, enabled);
  useLayoutEffect(() => {
    if (!enabled) return;
    const root = ref.current.el!;
    const clear = root.querySelector<HTMLElement>(".input-clear-button")!;
    const removeClear = applyNativeControlAttributes(clear, {
      role: "button", tabindex: disabled ? -1 : 0,
      "aria-label": t("common.clearSearch"), "aria-disabled": disabled,
    });
    const removeCancel = expandable ? applyNativeControlAttributes(root.querySelector<HTMLElement>(".searchbar-disable-button")!, {
      role: "button", tabindex: 0, "aria-label": t("common.cancel"),
    }) : undefined;
    root.classList.toggle("disabled", Boolean(disabled));
    return () => {removeClear?.(); removeCancel?.();};
  }, [disabled, enabled, expandable, ref, t]);
  return ref;
}
