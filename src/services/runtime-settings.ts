import { DATA_RETENTION } from "@/generated/data-retention";

let pushTokenConfirmationDays: number = DATA_RETENTION.pushTokenConfirmationDays;

export function seedRuntimeSettings(settings: { pushTokenConfirmationDays?: number }) {
  const days = Number(settings.pushTokenConfirmationDays);
  if (Number.isInteger(days) && days >= 1 && days <= 3_650) pushTokenConfirmationDays = days;
}

export function getPushTokenConfirmationIntervalMs() {
  return pushTokenConfirmationDays * 86_400_000;
}
