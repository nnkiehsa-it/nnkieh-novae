import * as React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
// Font faces load as files of their own so Vite resolves their relative URLs;
// Tailwind inlines `@import` without rebasing them.
import "@/assets/fonts/harmonyos-sans-tc/harmonyos-sans-tc.css";
import "@/assets/fonts/latin-fonts.css";
import "./globals.css";
import { bindRouter } from "@/lib/app-navigation";
import { registerServiceWorker } from "@/lib/service-worker";
import { handleGoogleCallbackPage } from "@/lib/google-identity";
import { createAppRouter } from "./routes";

// The Google sign-in callback only hands its result back; it never mounts the app.
if (!handleGoogleCallbackPage()) {
  const router = createAppRouter();
  bindRouter(router);

  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}

if (import.meta.env.PROD) {
  window.addEventListener("load", () => void registerServiceWorker().catch(() => undefined), { once: true });
}
