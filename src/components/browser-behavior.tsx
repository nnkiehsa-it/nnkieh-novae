"use client";

import { useEffect } from "react";
import { installBrowserBehavior } from "@/lib/browser-behavior";

export function BrowserBehavior() {
  useEffect(installBrowserBehavior, []);
  return null;
}
