import { asString } from "../shared/http.ts";
import { platformAdminEmails } from "../shared/platform-admin.ts";
import { selectAccountAccessRule, type AccountAccessPreset, type AccountAccessTargetType } from "../shared/account-access.ts";
import type { Selected } from "../database/schema.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";

const PRESETS = new Set(["read_only", "reaction_only", "blocked"]);
const DURATIONS = new Set(["keep", "7d", "30d", "custom", "permanent"]);
const PREFIX_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/u;

function targetFromInput(payload: JsonRecord) {
  const type = asString(payload.targetType);
  let value = asString(payload.targetValue).trim();
  if (!["uid", "email_prefix"].includes(type) || !value) throw new Error("validation-required");
  if (type === "email_prefix") {
    value = value.toLowerCase();
    if (value.length > 64 || !PREFIX_PATTERN.test(value)) throw new Error("validation-invalid");
  }
  return { type: type as AccountAccessTargetType, value };
}

export async function loadAccountAccessRules(database: BackendDatabase, filter: {
  userUids?: string[];
  targetType?: AccountAccessTargetType;
  targetValue?: string;
} = {}) {
  type Rule = Selected<"user_restrictions", "uid" | "target_type" | "preset" | "reason" | "restricted_until" | "restricted_permanently" | "updated_at">
    & { active: boolean; revision: string; match_count: number };
  const { rows } = await database.sql<Rule>`
    select r.uid, r.target_type, r.preset, r.reason, r.restricted_until, r.restricted_permanently, r.updated_at,
      coalesce(r.restricted_permanently or r.restricted_until > statement_timestamp(), false) as active,
      md5(to_jsonb(r)::text) as revision,
      (select count(*)::integer from app_private.user_profiles p
        where not (lower(btrim(coalesce(p.email, ''))) = any(${platformAdminEmails()}::text[]))
          and ((r.target_type = 'uid' and p.uid = r.uid)
            or (r.target_type = 'email_prefix' and starts_with(lower(split_part(coalesce(p.email, ''), '@', 1)), r.uid)))) as match_count
    from app_private.user_restrictions r
    where (${filter.userUids === undefined && filter.targetType === undefined}::boolean)
      or (${filter.targetType !== undefined}::boolean and r.target_type = ${filter.targetType ?? ""} and r.uid = ${filter.targetValue ?? ""})
      or (${filter.userUids !== undefined}::boolean and (
        (r.target_type = 'uid' and r.uid = any(${filter.userUids ?? []}::text[]))
        or (r.target_type = 'email_prefix' and (r.restricted_permanently or r.restricted_until > statement_timestamp()))))
    order by r.target_type, r.uid`;
  return rows.map((row) => ({
    active: row.active,
    expiresAt: row.restricted_until,
    matchCount: row.match_count,
    message: row.reason ?? "",
    permanent: row.restricted_permanently,
    preset: row.preset as AccountAccessPreset,
    revision: row.revision,
    targetType: row.target_type as AccountAccessTargetType,
    targetValue: row.uid,
    updatedAt: row.updated_at,
  }));
}

export async function handleAccountAccessRuleAction(action: string, payload: JsonRecord, auth: AuthContext, database: BackendDatabase) {
  if (action === "listAccountAccessRules") return { rules: await loadAccountAccessRules(database) };
  const target = targetFromInput(payload);
  if (payload.revision !== null && (typeof payload.revision !== "string" || !/^[a-f0-9]{32}$/u.test(payload.revision))) throw new Error("validation-required");
  if (action !== "previewAccountAccessRule") {
    await database.sql`select pg_advisory_xact_lock(hashtext(${`novae:account-rule:${target.type}:${target.value}`}))`;
    await database.sql`select uid from app_private.user_restrictions where target_type=${target.type} and uid=${target.value} for update`;
  }
  const [before] = await loadAccountAccessRules(database, { targetType: target.type, targetValue: target.value });
  if ((before?.revision ?? null) !== payload.revision) throw new Error("configuration-changed");
  if (action === "previewAccountAccessRule") {
    if (target.type !== "email_prefix") throw new Error("validation-invalid");
    validateRuleInput(payload, Boolean(before));
    const count = await database.sqlOne<{ count: number }>`select count(*)::integer as count from app_private.user_profiles p
      where starts_with(lower(split_part(coalesce(p.email, ''), '@', 1)), ${target.value})
        and not (lower(btrim(coalesce(p.email, ''))) = any(${platformAdminEmails()}::text[]))`;
    return { matchingCount: count.count, targetValue: target.value };
  }
  let profile: { uid: string; email: string | null; administrator: boolean } | null = null;
  if (target.type === "uid") {
    profile = await database.sqlMaybe<{ uid: string; email: string | null; administrator: boolean }>`
      select p.uid, p.email, coalesce(lower(btrim(p.email)) = any(${platformAdminEmails()}::text[]), false) as administrator
      from app_private.user_profiles p where p.uid = ${target.value} for update`;
  }
  let deleted = false;
  if (action === "saveAccountAccessRule") {
    const { preset, duration, message, hours } = validateRuleInput(payload, Boolean(before));
    if (target.type === "uid" && (!profile || profile.administrator || target.value === auth.uid)) throw new Error("permission-denied");
    const permanent = duration === "keep" ? before!.permanent : duration === "permanent";
    await database.sql`insert into app_private.user_restrictions
      (uid, target_type, preset, restricted_until, restricted_permanently, reason, updated_by, updated_at)
      values (${target.value}, ${target.type}, ${preset},
        case when ${duration} = 'keep' then ${before?.expiresAt ?? null}::timestamptz
          when ${permanent} then null else statement_timestamp() + make_interval(hours => ${hours}::integer) end,
        ${permanent}, ${message}, ${auth.uid}, statement_timestamp())
      on conflict (target_type, uid) do update set preset = excluded.preset, restricted_until = excluded.restricted_until,
        restricted_permanently = excluded.restricted_permanently, reason = excluded.reason,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at`;
  } else if (action === "deleteAccountAccessRule") {
    const removed = await database.sql`delete from app_private.user_restrictions
      where target_type = ${target.type} and uid = ${target.value} returning uid`;
    deleted = removed.rows.length > 0;
  } else throw new Error("invalid-action");
  const rules = await loadAccountAccessRules(database, target.type === "uid"
    ? { userUids: [target.value] } : { targetType: target.type, targetValue: target.value });
  const rule = rules.find((item) => item.targetType === target.type && item.targetValue === target.value) ?? null;
  const effectiveRule = profile && !profile.administrator
    ? selectAccountAccessRule(rules.filter((item) => item.active), { uid: target.value, email: profile.email ?? "" }) : null;
  return { deleted, effectiveRule, revision: rule?.revision ?? null, rule, success: true, targetType: target.type, targetValue: target.value };
}

function validateRuleInput(payload: JsonRecord, existing: boolean) {
  const preset = asString(payload.preset);
  const duration = asString(payload.duration);
  const message = asString(payload.message).trim();
  if (!PRESETS.has(preset) || !DURATIONS.has(duration) || !message) throw new Error("validation-required");
  if (message.length > 500) throw new Error("validation-invalid");
  if (duration === "keep" && !existing) throw new Error("validation-required");
  const hours = duration === "7d" ? 168 : duration === "30d" ? 720 : duration === "custom" ? payload.durationHours : 0;
  if (duration === "custom" && (typeof hours !== "number" || !Number.isInteger(hours) || hours < 1 || hours > 87_600)) throw new Error("validation-invalid");
  return { preset, duration, message, hours };
}
