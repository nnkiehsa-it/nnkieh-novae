import type { Env } from "./types";

const TURNSTILE_ACTION_PATTERN = /^[a-z0-9_-]{1,32}$/u;
const TURNSTILE_MAX_TOKEN_LENGTH = 2_048;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerificationResult {
  action?: string;
  hostname?: string;
  success?: boolean;
}

function allowedHostnames(env: Env) {
  return new Set(
    env.ALLOWED_ORIGINS.split(",")
      .map((origin) => {
        try {
          return new URL(origin.trim()).hostname.toLowerCase();
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );
}

export function validateTurnstileResult(
  result: TurnstileVerificationResult,
  env: Env,
  expectedAction: string,
) {
  const hostname = result.hostname?.trim().toLowerCase() ?? "";
  if (
    result.success !== true
    || result.action !== expectedAction
    || !hostname
    || !allowedHostnames(env).has(hostname)
  ) {
    throw new Error("turnstile-failed");
  }
}

export async function requireTurnstile(
  request: Request,
  env: Env,
  expectedAction: string,
) {
  if (!TURNSTILE_ACTION_PATTERN.test(expectedAction)) {
    throw new Error("service-not-configured");
  }
  const token = request.headers.get("x-turnstile-token")?.trim() ?? "";
  if (!token || token.length > TURNSTILE_MAX_TOKEN_LENGTH) {
    throw new Error("turnstile-failed");
  }
  // Local integration runs still enforce the presence/shape of the token,
  // but skip the external Cloudflare Siteverify request.
  if (env.LOCAL_TEST_MODE === "true") return;

  const body = new FormData();
  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);
  body.set("idempotency_key", crypto.randomUUID());
  const remoteIp = request.headers.get("cf-connecting-ip")?.trim();
  if (remoteIp) body.set("remoteip", remoteIp);

  let response: Response;
  try {
    response = await fetch(TURNSTILE_VERIFY_URL, {
      body,
      method: "POST",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new Error("upstream-unavailable");
  }
  if (!response.ok) throw new Error("upstream-unavailable");

  let result: TurnstileVerificationResult;
  try {
    result = await response.json() as TurnstileVerificationResult;
  } catch {
    throw new Error("upstream-invalid-response");
  }
  validateTurnstileResult(result, env, expectedAction);
}
