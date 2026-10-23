/// <reference lib="webworker" />

import { defaultCache } from "@serwist/vite/worker";
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";
import { canDisplayPushFor } from "@/lib/push-session";
import { sameOriginUrl } from "@/lib/same-origin-url";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "development";
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
};

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const payload = event.notification.data as
    | { FCM_MSG?: { data?: { link?: unknown } }; link?: unknown }
    | undefined;
  const link = sameOriginUrl(
    payload?.link ?? payload?.FCM_MSG?.data?.link,
    self.location.origin,
  );
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        includeUncontrolled: true,
        type: "window",
      });
      const matchingWindow = windows.find((client) => client.url === link);
      if (matchingWindow) await matchingWindow.focus();
      else await self.clients.openWindow(link);
    })(),
  );
});

if (
  firebaseConfig.apiKey &&
  firebaseConfig.appId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.projectId
) {
  // The worker is one classic script, which cannot import on demand, so
  // Firebase is bundled in and only started when it is configured.
  try {
    const messaging = getMessaging(initializeApp(firebaseConfig));
    onBackgroundMessage(messaging, async (payload) => {
      if (payload.notification || !await canDisplayPushFor(payload.data?.recipient_uid)) return;
      return self.registration.showNotification(
        payload.data?.title ?? "Novae",
        {
          badge: `/pwa-64x64.png?v=${encodeURIComponent(version)}`,
          body: payload.data?.body ?? "",
          data: { link: payload.data?.link ?? "/" },
          icon: `/pwa-192x192.png?v=${encodeURIComponent(version)}`,
        },
      );
    });
  } catch {
    // Without messaging the worker still serves the app.
  }
}

const serwist = new Serwist({
  clientsClaim: true,
  // Font shards are left out of the manifest at build time; see vite.config.ts.
  precacheEntries: self.__SW_MANIFEST,
  // Every address is the same single page, so a navigation is answered by the
  // precached shell, online or off. A new deployment arrives with the new
  // worker, which the update gate installs before it reloads.
  precacheOptions: {
    cleanupOutdatedCaches: true,
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/v1\//u, /^\/__\//u, /^\/(?:sw\.js|version\.json|manifest\.webmanifest)$/u],
  },
  // CacheStorage does not honor HTTP no-store. In particular, signed private
  // media must reach the Worker again so it can enforce token expiry.
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname.startsWith("/v1/") && (
        url.origin === self.location.origin
        || url.origin === new URL(process.env.NEXT_PUBLIC_API_BASE_URL || self.location.origin, self.location.origin).origin
      ),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  skipWaiting: true,
});

serwist.addEventListeners();
