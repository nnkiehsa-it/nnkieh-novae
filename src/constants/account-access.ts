export const ACCOUNT_ACCESS_PRESETS = ["read_only", "reaction_only", "blocked"] as const;
export const ACCOUNT_ACCESS_DURATIONS = ["7d", "30d", "custom", "permanent"] as const;

export const ACCOUNT_ACCESS_PRESET_KEYS = {
  blocked: "ui.accountAccess.preset.blocked",
  reaction_only: "ui.accountAccess.preset.reactionOnly",
  read_only: "ui.accountAccess.preset.readOnly",
} as const;

export const ACCOUNT_ACCESS_DURATION_KEYS = {
  "30d": "ui.accountAccess.duration.thirtyDays",
  "7d": "ui.accountAccess.duration.sevenDays",
  custom: "ui.accountAccess.duration.custom",
  permanent: "ui.accountAccess.duration.permanent",
} as const;
