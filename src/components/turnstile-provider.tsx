"use client";

import Script from "next/script";
import { ShieldCheck } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { t } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const siteKey = String(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
const TOKEN_TIMEOUT_MS = 60_000;

interface TurnstileApi {
  execute: (widgetId: string) => void;
  remove?: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: {
      action: string;
      appearance: "always";
      "error-callback": (errorCode?: string) => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
      "unsupported-callback": () => void;
      execution: "execute";
      callback: (token: string) => void;
      sitekey: string;
      size: "normal";
      theme: "auto";
    },
  ) => string;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileContextValue {
  requestToken: (action: string) => Promise<string | null>;
}

interface PendingChallenge {
  action: string;
  reject: (error: Error) => void;
  resolve: (token: string) => void;
}

const TurnstileContext = createContext<TurnstileContextValue>({
  requestToken: async () => null,
});

export function TurnstileProvider({
  children,
  nonce,
}: {
  children: ReactNode;
  nonce?: string;
}) {
  const [ready, setReady] = useState(false);
  const [challenge, setChallenge] = useState<PendingChallenge | null>(null);
  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const waiters = useRef<Array<{
    reject: (error: Error) => void;
    resolve: () => void;
  }>>([]);
  const pendingRequest = useRef<Promise<string | null> | null>(null);

  const resolveReady = useCallback(() => {
    setReady(true);
    waiters.current.splice(0).forEach(({ resolve }) => resolve());
  }, []);
  const rejectReady = useCallback(() => {
    waiters.current.splice(0).forEach(({ reject }) => reject(new Error("turnstile-unavailable")));
  }, []);

  const waitUntilReady = useCallback(async () => {
    if (window.turnstile || ready) return;
    await new Promise<void>((resolve, reject) => {
      const waiter = {
        reject: (error: Error) => {
          window.clearTimeout(timeout);
          reject(error);
        },
        resolve: () => {
          window.clearTimeout(timeout);
          resolve();
        },
      };
      const timeout = window.setTimeout(() => {
        waiters.current = waiters.current.filter((entry) => entry !== waiter);
        reject(new Error("turnstile-unavailable"));
      }, TOKEN_TIMEOUT_MS);
      waiters.current.push(waiter);
    });
  }, [ready]);

  useEffect(() => {
    if (!challenge) return;
    const turnstile = window.turnstile;
    const container = widgetHostRef.current;
    if (!turnstile || !container) return;

    let widgetId = "";
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (widgetId) turnstile.remove?.(widgetId);
      setChallenge((current) => current === challenge ? null : current);
      callback();
    };
    const timeout = window.setTimeout(() => {
      finish(() => challenge.reject(new Error("turnstile-timeout")));
    }, TOKEN_TIMEOUT_MS);

    widgetId = turnstile.render(container, {
      action: challenge.action,
      appearance: "always",
      "error-callback": () => finish(() => challenge.reject(new Error("turnstile-failed"))),
      "expired-callback": () => finish(() => challenge.reject(new Error("turnstile-expired"))),
      "timeout-callback": () => finish(() => challenge.reject(new Error("turnstile-timeout"))),
      "unsupported-callback": () => finish(() => challenge.reject(new Error("turnstile-unsupported"))),
      execution: "execute",
      callback: (token) => finish(() => challenge.resolve(token)),
      sitekey: siteKey,
      size: "normal",
      theme: "auto",
    });
    turnstile.execute(widgetId);

    return () => {
      window.clearTimeout(timeout);
      if (!settled && widgetId) turnstile.remove?.(widgetId);
    };
  }, [challenge]);

  const requestToken = useCallback(async (action: string) => {
    if (!siteKey) return null;
    if (pendingRequest.current) return pendingRequest.current;
    const request = (async () => {
      await waitUntilReady();
      if (!window.turnstile) throw new Error("turnstile-unavailable");
      return await new Promise<string>((resolve, reject) => {
        setChallenge({ action, reject, resolve });
      });
    })();
    pendingRequest.current = request;
    try {
      return await request;
    } finally {
      pendingRequest.current = null;
    }
  }, [waitUntilReady]);

  const value = useMemo(() => ({ requestToken }), [requestToken]);
  return (
    <TurnstileContext.Provider value={value}>
      {siteKey ? (
        <Script
          nonce={nonce}
          onError={rejectReady}
          onLoad={resolveReady}
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
        />
      ) : null}
      {children}
      <Dialog open={challenge !== null} onOpenChange={() => undefined}>
        <DialogContent
          className="max-w-sm gap-5"
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="items-center text-center sm:items-center sm:text-center">
            <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-[var(--tint-content)]">
              <ShieldCheck className="size-5" aria-hidden />
            </div>
            <DialogTitle>{t("auth.loginVerification")}</DialogTitle>
            <DialogDescription>
              {t("auth.signingIn")}
            </DialogDescription>
          </DialogHeader>
          <div className="mx-auto w-full overflow-hidden rounded-xl border bg-background/70 p-3 shadow-sm">
            <div
              ref={widgetHostRef}
              className="mx-auto min-h-[65px] w-[300px] max-w-full"
            />
          </div>
        </DialogContent>
      </Dialog>
    </TurnstileContext.Provider>
  );
}

export function useTurnstile() {
  return useContext(TurnstileContext);
}
