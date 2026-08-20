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
  const [debugError, setDebugError] = useState("");
  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const waiters = useRef<Array<{
    reject: (error: Error) => void;
    resolve: () => void;
  }>>([]);
  const pendingRequest = useRef<Promise<string | null> | null>(null);

  const resolveReady = useCallback(() => {
    console.info("[Turnstile] script loaded", {
      hostname: window.location.hostname,
      hasApi: Boolean(window.turnstile),
      hasSiteKey: Boolean(siteKey),
    });
    setReady(true);
    waiters.current.splice(0).forEach(({ resolve }) => resolve());
  }, []);
  const rejectReady = useCallback(() => {
    console.error("[Turnstile] failed to load Cloudflare script", {
      hostname: window.location.hostname,
      hasSiteKey: Boolean(siteKey),
    });
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
    if (!turnstile || !container) {
      const details = {
        action: challenge.action,
        hasContainer: Boolean(container),
        hasTurnstileApi: Boolean(turnstile),
        hostname: window.location.hostname,
      };
      console.error("[Turnstile] render precondition failed", details);
      setDebugError(`render precondition failed: ${JSON.stringify(details)}`);
      window.setTimeout(() => {
        challenge.reject(new Error("turnstile-unavailable"));
        setChallenge((current) => current === challenge ? null : current);
      }, 0);
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
      console.error("[Turnstile] challenge timed out", {
        action: challenge.action,
        hostname: window.location.hostname,
        timeoutMs: TOKEN_TIMEOUT_MS,
        widgetId,
      });
      setDebugError(`challenge timeout after ${TOKEN_TIMEOUT_MS}ms (action=${challenge.action}, widgetId=${widgetId || "none"})`);
      finish(() => challenge.reject(new Error("turnstile-timeout")));
    }, TOKEN_TIMEOUT_MS);

    try {
      console.info("[Turnstile] rendering challenge", {
        action: challenge.action,
        hostname: window.location.hostname,
        siteKeySuffix: siteKey.slice(-6),
      });

      widgetId = turnstile.render(container, {
        action: challenge.action,
        appearance: "always",
        "error-callback": (errorCode) => {
          const code = errorCode || "unknown";
          console.error("[Turnstile] Cloudflare error-callback", {
            action: challenge.action,
            errorCode: code,
            hostname: window.location.hostname,
            widgetId,
          });
          setDebugError(`Cloudflare error-callback: ${code} (action=${challenge.action}, widgetId=${widgetId || "pending"})`);
          finish(() => challenge.reject(new Error(`turnstile-failed:${code}`)));
          return true;
        },
        "expired-callback": () => {
          console.error("[Turnstile] token expired", { action: challenge.action, widgetId });
          setDebugError(`token expired (action=${challenge.action}, widgetId=${widgetId || "none"})`);
          finish(() => challenge.reject(new Error("turnstile-expired")));
        },
        "timeout-callback": () => {
          console.error("[Turnstile] Cloudflare timeout-callback", { action: challenge.action, widgetId });
          setDebugError(`Cloudflare timeout-callback (action=${challenge.action}, widgetId=${widgetId || "none"})`);
          finish(() => challenge.reject(new Error("turnstile-timeout")));
        },
        "unsupported-callback": () => {
          console.error("[Turnstile] browser unsupported", {
            action: challenge.action,
            hostname: window.location.hostname,
            userAgent: navigator.userAgent,
          });
          setDebugError(`browser unsupported (action=${challenge.action})`);
          finish(() => challenge.reject(new Error("turnstile-unsupported")));
        },
        execution: "execute",
        callback: (token) => {
          console.info("[Turnstile] challenge succeeded", {
            action: challenge.action,
            tokenLength: token.length,
            widgetId,
          });
          setDebugError("");
          finish(() => challenge.resolve(token));
        },
        sitekey: siteKey,
        size: "normal",
        theme: "auto",
      });

      console.info("[Turnstile] render returned", {
        action: challenge.action,
        widgetId,
      });
      turnstile.execute(widgetId);
      console.info("[Turnstile] execute called", {
        action: challenge.action,
        widgetId,
      });
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error("[Turnstile] render/execute threw", {
        action: challenge.action,
        error,
        hostname: window.location.hostname,
        widgetId,
      });
      setDebugError(`render/execute threw: ${message} (action=${challenge.action}, widgetId=${widgetId || "none"})`);
      finish(() => challenge.reject(error instanceof Error ? error : new Error(message)));
    }

    return () => {
      window.clearTimeout(timeout);
      if (!settled && widgetId) turnstile.remove?.(widgetId);
    };
  }, [challenge]);

  const requestToken = useCallback(async (action: string) => {
    if (!siteKey) return null;
    if (pendingRequest.current) return pendingRequest.current;
    const request = (async () => {
      setDebugError("");
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
          {debugError ? (
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg border bg-muted/50 p-3 text-xs text-destructive">
              {debugError}
            </pre>
          ) : null}
        </DialogContent>
      </Dialog>
    </TurnstileContext.Provider>
  );
}

export function useTurnstile() {
  return useContext(TurnstileContext);
}
