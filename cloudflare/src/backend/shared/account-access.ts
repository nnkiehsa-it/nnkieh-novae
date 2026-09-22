import type { Selected } from "../database/schema.ts";
import type { BackendDatabase } from "../actions/types.ts";

export type AccountAccessPreset = "read_only" | "reaction_only" | "blocked";
export type AccountAccessTargetType = "uid" | "email_prefix";

export interface AccountAccessRule {
  expiresAt: string | null;
  message: string;
  preset: AccountAccessPreset;
  targetType: AccountAccessTargetType;
  targetValue: string;
}

export class AccountAccessError extends Error {
  readonly publicMessage: string;

  constructor(message: string) {
    super("account-restricted");
    this.name = "AccountAccessError";
    this.publicMessage = message;
  }
}

function emailLocalPart(email: string) {
  return email.slice(0, email.lastIndexOf("@")).trim().toLowerCase();
}

export function selectAccountAccessRule(
  rules: AccountAccessRule[],
  identity: { email: string; uid: string },
) {
  const exact = rules.find(
    (rule) => rule.targetType === "uid" && rule.targetValue === identity.uid,
  );
  if (exact) return exact;
  const localPart = emailLocalPart(identity.email);
  return rules
    .filter(
      (rule) => rule.targetType === "email_prefix" && localPart.startsWith(rule.targetValue),
    )
    .sort((left, right) => right.targetValue.length - left.targetValue.length)[0] ?? null;
}

export async function listActiveAccountAccessRules(database: BackendDatabase) {
  const { rows } = await database.sql<Selected<
    "user_restrictions",
    "uid" | "target_type" | "preset" | "reason" | "restricted_until"
  >>`select uid, target_type, preset, reason, restricted_until
      from app_private.user_restrictions
      where restricted_permanently or restricted_until > now()
      order by case when target_type = 'uid' then 0 else 1 end,
        char_length(uid) desc, uid`;
  return rows.map((row) => ({
    expiresAt: row.restricted_until,
    message: row.reason ?? "",
    preset: row.preset as AccountAccessPreset,
    targetType: row.target_type as AccountAccessTargetType,
    targetValue: row.uid,
  }));
}

export async function resolveAccountAccessRule(
  database: BackendDatabase,
  identity: { email: string; uid: string },
) {
  const localPart = emailLocalPart(identity.email);
  const row = await database.sqlMaybe<Selected<
    "user_restrictions",
    "uid" | "target_type" | "preset" | "reason" | "restricted_until"
  >>`select uid, target_type, preset, reason, restricted_until
      from app_private.user_restrictions
      where (restricted_permanently or restricted_until > now())
        and ((target_type = 'uid' and uid = ${identity.uid})
          or (target_type = 'email_prefix' and starts_with(${localPart}, uid)))
      order by case when target_type = 'uid' then 0 else 1 end,
        char_length(uid) desc
      limit 1`;
  return row ? {
    expiresAt: row.restricted_until,
    message: row.reason ?? "",
    preset: row.preset as AccountAccessPreset,
    targetType: row.target_type as AccountAccessTargetType,
    targetValue: row.uid,
  } : null;
}
