/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

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

function normalizeNotificationLink(value: unknown) {
  const fallback = new URL("/", self.location.origin).href;
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return new URL(value, self.location.origin).href;
  } catch {
    return fallback;
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const payload = event.notification.data as
    | { FCM_MSG?: { data?: { link?: unknown } }; link?: unknown }
    | undefined;
  const link = normalizeNotificationLink(
    payload?.link ?? payload?.FCM_MSG?.data?.link,
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
  void Promise.all([import("firebase/app"), import("firebase/messaging/sw")])
    .then(([firebaseApp, firebaseMessaging]) => {
      const firebase = firebaseApp.initializeApp(firebaseConfig);
      const messaging = firebaseMessaging.getMessaging(firebase);
      firebaseMessaging.onBackgroundMessage(messaging, (payload) => {
        if (payload.notification) return;
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
    })
    .catch(() => undefined);
}

const serwist = new Serwist({
  clientsClaim: true,
  navigationPreload: true,
  precacheEntries: self.__SW_MANIFEST?.filter((entry) => {
    const value = typeof entry === "string" ? entry : entry.url;
    return !new URL(value, self.location.origin).pathname.endsWith(".woff2");
  }),
  runtimeCaching: defaultCache,
  skipWaiting: true,
});

serwist.addEventListeners();
