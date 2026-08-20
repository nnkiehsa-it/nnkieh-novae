import type { IdTokenResult, User } from "firebase/auth";
import { allowedDomain } from "@/lib/firebase";
import { sessionDebug } from "@/lib/session-debug";
import { withRequestTimeout } from "@/lib/request";
import { t } from "@/i18n";

export interface ValidationResult {
  ok: boolean;
  reason: string;
}

function domainFromEmail(email: string | null | undefined) {
  const parts = String(email ?? "")
    .trim()
    .toLowerCase()
    .split("@");
  return parts.length === 2 ? parts[1] : "";
}

function googleIdentityCount(token: IdTokenResult) {
  const identities = token.claims.firebase?.identities;
  const googleIdentity =
    identities && typeof identities === "object"
      ? (identities as Record<string, unknown>)["google.com"]
      : null;
  return Array.isArray(googleIdentity) ? googleIdentity.length : 0;
}

export function validateBasicUser(user: User | null): ValidationResult {
  const expectedDomain = allowedDomain || "auth.designateAnOnCampusDomain";
  if (!user?.email)
    return { ok: false, reason: "auth.schoolVerificationFailed" };
  if (!user.emailVerified)
    return { ok: false, reason: "auth.schoolVerificationRequired" };
  if (domainFromEmail(user.email) !== allowedDomain) {
    return {
      ok: false,
      reason: t("auth.schoolDomain", { domain: t(expectedDomain) }),
    };
  }
  return { ok: true, reason: "" };
}

export async function validateUserAgainstToken(
  user: User,
): Promise<ValidationResult> {
  const token = await withRequestTimeout(() => user.getIdTokenResult(), {
    label: "auth.loginVerification",
  });
  const email = String(token.claims.email ?? user.email ?? "")
    .trim()
    .toLowerCase();
  const signInProvider = String(token.claims.firebase?.sign_in_provider ?? "");
  const emailVerified = Boolean(
    token.claims.email_verified ?? user.emailVerified,
  );
  const expectedDomain = allowedDomain || "auth.designateAnOnCampusDomain";
  sessionDebug("token validated", { signInProvider });
  if (!email) return { ok: false, reason: "auth.schoolVerificationFailed" };
  if (domainFromEmail(email) !== allowedDomain) {
    return {
      ok: false,
      reason: t("auth.schoolDomain", { domain: t(expectedDomain) }),
    };
  }
  if (!emailVerified)
    return { ok: false, reason: "auth.schoolVerificationRequired" };
  if (signInProvider !== "google.com" && googleIdentityCount(token) === 0) {
    return {
      ok: false,
      reason: "auth.pleaseUseTheDesignatedSchoolAccountToLogIn",
    };
  }
  return { ok: true, reason: "" };
}
