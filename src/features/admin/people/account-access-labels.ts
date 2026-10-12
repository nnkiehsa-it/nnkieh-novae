import { ACCOUNT_ACCESS_DURATION_KEYS, ACCOUNT_ACCESS_PRESET_KEYS } from "@/constants/account-access";
import type { AccountAccessDuration, AccountAccessPreset } from "@/hooks/use-admin-console";
import { formatDate } from "@/lib/format";
import type { Translate } from "../shared/translate";

/** The deadline an existing rule already carries, which a draft may choose to keep. */
export interface KeptDeadline {
  keptDeadline: string | null;
  keptPermanent: boolean;
}

export function presetLabel(preset: AccountAccessPreset, t: Translate) {
  return t(ACCOUNT_ACCESS_PRESET_KEYS[preset]);
}

export function keptLabel({ keptDeadline, keptPermanent }: KeptDeadline, t: Translate) {
  if (keptPermanent) return t("ui.accountAccess.duration.permanent");
  return keptDeadline ? formatDate(new Date(keptDeadline)) : "—";
}

export function durationLabel(duration: AccountAccessDuration, kept: KeptDeadline, t: Translate) {
  return duration === "keep" ? keptLabel(kept, t) : t(ACCOUNT_ACCESS_DURATION_KEYS[duration]);
}
