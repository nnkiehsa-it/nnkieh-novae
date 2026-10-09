"use client";

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type Ref } from "react";
import { createPortal } from "react-dom";
import { f7ready } from "framework7-react";
import type { Dialog } from "framework7/types";
import { useI18n } from "@/i18n";
import { bindNativeModalCleanup } from "./ui/native-modal-lifecycle";

/** Keep the challenge iframe laid out silently, then present the same node in a native Dialog. */
export function TurnstileDialog({ opened, onClosed, hostRef }: {
  opened: boolean;
  onClosed: () => void;
  hostRef: Ref<HTMLDivElement>;
}) {
  const { t } = useI18n();
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<Dialog.Dialog | null>(null);
  const latest = useRef({ opened, onClosed });
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  useLayoutEffect(() => { latest.current = { opened, onClosed }; });
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    f7ready((app) => {
      if (disposed) return;
      const params = {
        el: element.current!,
        containerEl: document.body,
        backdrop: true,
        backdropUnique: true,
        closeByBackdropClick: false,
        closeOnEscape: false,
        animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        on: { closed: () => latest.current.onClosed() },
      };
      instance.current = app.dialog.create(params);
      bindNativeModalCleanup(instance.current, false);
      if (latest.current.opened) instance.current.open();
    });
    return () => {
      disposed = true;
      instance.current?.close(false);
      instance.current?.destroy();
      instance.current = null;
    };
  }, [ready]);
  useEffect(() => {
    if (opened) instance.current?.open();
    else instance.current?.close();
  }, [opened]);

  if (!ready) return null;
  return createPortal(
    <div ref={element} className="dialog dialog-no-buttons novae-dialog novae-turnstile-dialog"
      role="alertdialog" aria-modal={opened || undefined} aria-hidden={!opened}
      aria-labelledby="turnstile-gate-title" aria-describedby="turnstile-gate-description" tabIndex={-1}>
      <div className="dialog-inner">
        <h2 className="dialog-title" id="turnstile-gate-title">{t("auth.loginVerification")}</h2>
        <p className="dialog-text" id="turnstile-gate-description">{t("auth.securityCheckPrompt")}</p>
        <div ref={hostRef} className="mt-4 min-h-[65px] w-[300px] max-w-full" />
      </div>
    </div>,
    document.body,
  );
}
