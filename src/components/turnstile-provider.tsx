"use client";

import Script from "next/script";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const siteKey = String(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
const TOKEN_TIMEOUT_MS = 60_000;

interface TurnstileApi {
  execute: (widgetId: string) => void;
  remove?: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: {
      action: string;
      appearance: "interaction-only";
      "error-callback": () => void;
      "expired-callback": () => void;
      execution: "execute";
      callback: (token: string) => void;
      sitekey: string;
      size: "invisible";
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

  const requestToken = useCallback(async (action: string) => {
    if (!siteKey) return null;
    if (pendingRequest.current) return pendingRequest.current;
    const request = (async () => {
      await waitUntilReady();
      const turnstile = window.turnstile;
      if (!turnstile) throw new Error("turnstile-unavailable");
      const container = document.createElement("div");
      container.setAttribute("aria-hidden", "true");
      container.style.height = "1px";
      container.style.left = "-10000px";
      container.style.overflow = "hidden";
      container.style.position = "fixed";
      container.style.top = "0";
      container.style.width = "1px";
      document.body.appendChild(container);

      return await new Promise<string>((resolve, reject) => {
        let widgetId = "";
        const timeout = window.setTimeout(() => {
          if (widgetId) turnstile.remove?.(widgetId);
          container.remove();
          reject(new Error("turnstile-timeout"));
        }, TOKEN_TIMEOUT_MS);
        const finish = (callback: () => void) => {
          window.clearTimeout(timeout);
          if (widgetId) turnstile.remove?.(widgetId);
          container.remove();
          callback();
        };
        widgetId = turnstile.render(container, {
          action,
          appearance: "interaction-only",
          "error-callback": () => finish(() => reject(new Error("turnstile-failed"))),
          "expired-callback": () => finish(() => reject(new Error("turnstile-expired"))),
          execution: "execute",
          callback: (token) => finish(() => resolve(token)),
          sitekey: siteKey,
          size: "invisible",
        });
        turnstile.execute(widgetId);
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
    </TurnstileContext.Provider>
  );
}

export function useTurnstile() {
  return useContext(TurnstileContext);
}
