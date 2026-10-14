import type { ActionInput } from "../../../../shared/actions.ts";
import { platformAdminEmails } from "../shared/platform-admin.ts";
import { selectAccountAccessRule, type AccountAccessPreset, type AccountAccessTargetType } from "../shared/account-access.ts";
import type { Selected } from "../database/schema.ts";
import type { AuthContext, BackendDatabase } from "./types.ts";

type RuleTarget = ActionInput<"deleteAccountAccessRule">;
type RuleDraft = ActionInput<"saveAccountAccessRule">;

const PREFIX_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/u;

function targetOf(input: RuleTarget) {
  if (input.targetType === "uid") return { type: input.targetType, value: input.targetValue };
  const value = input.targetValue.toLowerCase();
  if (value.length > 64 || !PREFIX_PATTERN.test(value)) throw new Error("validation-invalid");
  return { type: input.targetType, value };
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

export async function listAccountAccessRules(_input: ActionInput<"listAccountAccessRules">, _auth: AuthContext, database: BackendDatabase) {
  return { rules: await loadAccountAccessRules(database) };
}

/** The rule as it stands; a draft written against an older revision is refused. */
async function currentRule(input: RuleTarget, database: BackendDatabase, lock: boolean) {
  const target = targetOf(input);
  if (lock) {
    await database.sql`select pg_advisory_xact_lock(hashtext(${`novae:account-rule:${target.type}:${target.value}`}))`;
    await database.sql`select uid from app_private.user_restrictions where target_type=${target.type} and uid=${target.value} for update`;
  }
  const [before] = await loadAccountAccessRules(database, { targetType: target.type, targetValue: target.value });
  if ((before?.revision ?? null) !== input.revision) throw new Error("configuration-changed");
  return { before, target };
}

export async function previewAccountAccessRule(input: ActionInput<"previewAccountAccessRule">, _auth: AuthContext, database: BackendDatabase) {
  const { before, target } = await currentRule(input, database, false);
  if (target.type !== "email_prefix") throw new Error("validation-invalid");
  durationOf(input, Boolean(before));
  const count = await database.sqlOne<{ count: number }>`select count(*)::integer as count from app_private.user_profiles p
    where starts_with(lower(split_part(coalesce(p.email, ''), '@', 1)), ${target.value})
      and not (lower(btrim(coalesce(p.email, ''))) = any(${platformAdminEmails()}::text[]))`;
  return { matchingCount: count.count, targetValue: target.value };
}

export async function saveAccountAccessRule(input: ActionInput<"saveAccountAccessRule">, auth: AuthContext, database: BackendDatabase) {
  const { before, target } = await currentRule(input, database, true);
  const profile = await lockedProfile(target, database);
  const hours = durationOf(input, Boolean(before));
  if (target.type === "uid" && (!profile || profile.administrator || target.value === auth.uid)) throw new Error("permission-denied");
  const permanent = input.duration === "keep" ? before!.permanent : input.duration === "permanent";
  await database.sql`insert into app_private.user_restrictions
    (uid, target_type, preset, restricted_until, restricted_permanently, reason, updated_by, updated_at)
    values (${target.value}, ${target.type}, ${input.preset},
      case when ${input.duration} = 'keep' then ${before?.expiresAt ?? null}::timestamptz
        when ${permanent} then null else statement_timestamp() + make_interval(hours => ${hours}::integer) end,
      ${permanent}, ${input.message}, ${auth.uid}, statement_timestamp())
    on conflict (target_type, uid) do update set preset = excluded.preset, restricted_until = excluded.restricted_until,
      restricted_permanently = excluded.restricted_permanently, reason = excluded.reason,
      updated_by = excluded.updated_by, updated_at = excluded.updated_at`;
  return await ruleChange(target, profile, false, database);
}

export async function deleteAccountAccessRule(input: ActionInput<"deleteAccountAccessRule">, _auth: AuthContext, database: BackendDatabase) {
  const { target } = await currentRule(input, database, true);
  const profile = await lockedProfile(target, database);
  const removed = await database.sql`delete from app_private.user_restrictions
    where target_type = ${target.type} and uid = ${target.value} returning uid`;
  return await ruleChange(target, profile, removed.rows.length > 0, database);
}

type Target = ReturnType<typeof targetOf>;
type LockedProfile = { uid: string; email: string | null; administrator: boolean } | null;

async function lockedProfile(target: Target, database: BackendDatabase): Promise<LockedProfile> {
  if (target.type !== "uid") return null;
  return await database.sqlMaybe<{ uid: string; email: string | null; administrator: boolean }>`
    select p.uid, p.email, coalesce(lower(btrim(p.email)) = any(${platformAdminEmails()}::text[]), false) as administrator
    from app_private.user_profiles p where p.uid = ${target.value} for update`;
}

async function ruleChange(target: Target, profile: LockedProfile, deleted: boolean, database: BackendDatabase) {
  const rules = await loadAccountAccessRules(database, target.type === "uid"
    ? { userUids: [target.value] } : { targetType: target.type, targetValue: target.value });
  const rule = rules.find((item) => item.targetType === target.type && item.targetValue === target.value) ?? null;
  const effectiveRule = profile && !profile.administrator
    ? selectAccountAccessRule(rules.filter((item) => item.active), { uid: target.value, email: profile.email ?? "" }) : null;
  return { deleted, effectiveRule, revision: rule?.revision ?? null, rule, success: true, targetType: target.type, targetValue: target.value };
}

/** The hours a new rule lasts; `keep` only makes sense for a rule that exists. */
function durationOf(input: RuleDraft, existing: boolean) {
  if (input.duration === "keep" && !existing) throw new Error("validation-required");
  if (input.duration === "custom" && input.durationHours === undefined) throw new Error("validation-invalid");
  return input.duration === "7d" ? 168 : input.duration === "30d" ? 720 : input.duration === "custom" ? input.durationHours! : 0;
}
