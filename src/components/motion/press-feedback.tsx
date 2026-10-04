"use client";

import { useEffect } from "react";
import { installPressFeedback } from "@/lib/press-feedback";

export function PressFeedback() {
  useEffect(installPressFeedback, []);
  return null;
}
