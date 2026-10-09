"use client";

import { f7, f7ready } from "framework7-react";
import { t } from "@/i18n";

function show(message: string) {
  f7ready(() => {
    const content = document.createElement("span");
    content.textContent = message;
    const toast = f7.toast.create({ text: content.innerHTML, position: "bottom", cssClass: "novae-toast",
      closeTimeout: 5000, closeButton: true, closeButtonText: t("common.close"), destroyOnClose: true });
    toast.open();
    toast.el.setAttribute("role", "status");
    toast.el.setAttribute("aria-live", "polite");
  });
}
export const toast = { success: show, error: show, info: show };
