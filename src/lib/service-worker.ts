/**
 * The one way the app registers its service worker, so the first
 * registration and the update check before a reload always agree on it.
 * The worker is a single classic script; `updateViaCache: "none"` makes every
 * check reach the network.
 */
export function registerServiceWorker() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}
