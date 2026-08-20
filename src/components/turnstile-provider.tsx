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
      "error-callback": (errorCode?: string) => boolean | void;
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
  requestToken: (
    action: string,
    options?: { presentation?: "dialog" | "inline" },
  ) => Promise<string | null>;
  setInlineHost: (host: HTMLDivElement | null) => void;
}

interface PendingChallenge {
  action: string;
  presentation: "dialog" | "inline";
  reject: (error: Error) => void;
  resolve: (token: string) => void;
}

const TurnstileContext = createContext<TurnstileContextValue>({
  requestToken: async () => null,
  setInlineHost: () => undefined,
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
  const [dialogHost, setDialogHost] = useState<HTMLDivElement | null>(null);
  const [inlineHost, setInlineHost] = useState<HTMLDivElement | null>(null);
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
    const container = challenge.presentation === "inline" ? inlineHost : dialogHost;
    if (!turnstile) {
      window.setTimeout(() => {
        challenge.reject(new Error("turnstile-unavailable"));
        setChallenge((current) => current === challenge ? null : current);
      }, 0);
      return;
    }
    if (!container) {
      return;
    }

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

    try {
      widgetId = turnstile.render(container, {
        action: challenge.action,
        appearance: "always",
        "error-callback": (errorCode) => {
          if (process.env.NODE_ENV === "development") {
            console.debug("[Turnstile] challenge rejected", errorCode || "unknown");
          }
          finish(() => challenge.reject(new Error("turnstile-failed")));
          return true;
        },
        "expired-callback": () => {
          finish(() => challenge.reject(new Error("turnstile-expired")));
        },
        "timeout-callback": () => {
          finish(() => challenge.reject(new Error("turnstile-timeout")));
        },
        "unsupported-callback": () => {
          finish(() => challenge.reject(new Error("turnstile-unsupported")));
        },
        execution: "execute",
        callback: (token) => {
          finish(() => challenge.resolve(token));
        },
        sitekey: siteKey,
        size: "normal",
        theme: "auto",
      });
      turnstile.execute(widgetId);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        console.debug("[Turnstile] render/execute failed", message);
      }
      finish(() => challenge.reject(new Error("turnstile-unavailable")));
    }

    return () => {
      window.clearTimeout(timeout);
      if (!settled && widgetId) turnstile.remove?.(widgetId);
    };
  }, [challenge, dialogHost, inlineHost]);

  const requestToken = useCallback(async (
    action: string,
    options?: { presentation?: "dialog" | "inline" },
  ) => {
    if (!siteKey) return null;
    if (pendingRequest.current) return pendingRequest.current;
    const request = (async () => {
      await waitUntilReady();
      if (!window.turnstile) throw new Error("turnstile-unavailable");
      return await new Promise<string>((resolve, reject) => {
        setChallenge({
          action,
          presentation: options?.presentation ?? "dialog",
          reject,
          resolve,
        });
      });
    })();
    pendingRequest.current = request;
    try {
      return await request;
    } finally {
      pendingRequest.current = null;
    }
  }, [waitUntilReady]);

  const value = useMemo(
    () => ({ requestToken, setInlineHost }),
    [requestToken],
  );
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
      <Dialog
        open={challenge?.presentation === "dialog"}
        onOpenChange={() => undefined}
      >
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
          <div className="flex min-h-[65px] w-full items-center justify-center overflow-hidden">
            <div
              ref={setDialogHost}
              className="min-h-[65px] w-[300px] max-w-full"
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

export function TurnstileInlineHost() {
  const { setInlineHost } = useTurnstile();
  return (
    <div className="flex min-h-[65px] w-full items-center justify-center overflow-hidden">
      <div
        ref={setInlineHost}
        className="min-h-[65px] w-[300px] max-w-full"
      />
    </div>
  );
}
