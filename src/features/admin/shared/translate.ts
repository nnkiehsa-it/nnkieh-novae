import type { useI18n } from "@/i18n";

/** The translator `useI18n` hands out, for helpers that format text outside a component. */
export type Translate = ReturnType<typeof useI18n>["t"];
