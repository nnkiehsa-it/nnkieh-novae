import { FirebaseError } from "firebase/app";
import {
  type Auth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, allowedDomain } from "@/lib/firebase";
import {
  GoogleIdentityError,
  requestGoogleIdToken,
  startGoogleRedirect,
  takeGoogleRedirectResult,
} from "@/lib/google-identity";
import { readLocalStorage, writeLocalStorage } from "@/lib/browser-storage";
import { withRequestTimeout } from "@/lib/request";
import { sessionDebug } from "@/lib/session-debug";
import { detectInAppBrowser } from "@/lib/in-app-browser";
import { apiGatewayUrl, hasApiGatewayConfig } from "@/lib/api-gateway";
import { revokeCurrentDevicePush } from "@/services/push-token-registration";


const LOGIN_ATTEMPT_KEY = "novae-login-attempts";
const LOGIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1_000;
const LOGIN_ATTEMPT_LIMIT = 30;
const LOGIN_CLICK_COOLDOWN_MS = 2_000;
const authEmulatorUrl = String(
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL ?? "",
).trim();
const googleClientId = String(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
).trim();
let lastLoginAttemptAt = 0;
let loginEntrancePrepared = false;
const TURNSTILE_SERVER_RETRY_LIMIT = 3;

function loginEntranceVerified() {
  return loginEntrancePrepared;
}

export function consumePreparedLoginEntrance() {
  if (!loginEntrancePrepared) return false;
  loginEntrancePrepared = false;
  return true;
}

async function verifyTurnstileEndpoint(options: {
  action: "auth_login" | "auth_restore";
  path: "/v1/auth/login-check" | "/v1/auth/session-check";
  presentation: "dialog" | "inline";
  requestTurnstileToken?: (
    action: string,
    options?: { presentation?: "dialog" | "inline" },
  ) => Promise<string | null>;
}) {
  for (let attempt = 0; attempt < TURNSTILE_SERVER_RETRY_LIMIT; attempt += 1) {
    const token = await options.requestTurnstileToken?.(options.action, {
      presentation: options.presentation,
    }) ?? null;
    if (!token) return false;
    const response = await withRequestTimeout(
      (signal) => fetch(apiGatewayUrl(options.path), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Turnstile-Token": token,
        },
        body: "{}",
        signal,
      }),
      { label: "auth.loginVerification" },
    );
    if (response.ok) return true;
    if (response.status !== 401) return false;
  }
  return false;
}

export async function verifyRestoredSession(options: {
  requestTurnstileToken?: (
    action: string,
    options?: { presentation?: "dialog" | "inline" },
  ) => Promise<string | null>;
} = {}) {
  if (authEmulatorUrl || !hasApiGatewayConfig()) return "";
  try {
    const verified = await verifyTurnstileEndpoint({
      action: "auth_restore",
      path: "/v1/auth/session-check",
      presentation: "dialog",
      requestTurnstileToken: options.requestTurnstileToken,
    });
    return verified ? "" : "auth.securityCheckFailed";
  } catch {
    return "auth.securityCheckFailed";
  }
}

export async function prepareGoogleLoginEntrance(options: {
  requestTurnstileToken?: (
    action: string,
    options?: { presentation?: "dialog" | "inline" },
  ) => Promise<string | null>;
} = {}) {
  if (!auth) return "auth.serviceUnavailable";
  if (!authEmulatorUrl && !googleClientId) return "auth.loginWidgetInitFailed";
  if (typeof navigator !== "undefined" && detectInAppBrowser(navigator.userAgent))
    return "auth.systemBrowserRequired";
  if (loginEntranceVerified()) return "";

  try {
    if (!authEmulatorUrl && hasApiGatewayConfig()) {
      const verified = await verifyTurnstileEndpoint({
        action: "auth_login",
        path: "/v1/auth/login-check",
        presentation: "inline",
        requestTurnstileToken: options.requestTurnstileToken,
      });
      if (!verified) return "auth.securityCheckFailed";
    }
    loginEntrancePrepared = true;
    return "";
  } catch (error) {
    sessionDebug("login preparation failed", error);
    return loginError(error);
  }
}

function claimLoginAttempt() {
  const now = Date.now();
  if (now - lastLoginAttemptAt < LOGIN_CLICK_COOLDOWN_MS) return false;
  lastLoginAttemptAt = now;
  try {
    const parsed = JSON.parse(
      readLocalStorage(LOGIN_ATTEMPT_KEY) ?? "[]",
    ) as unknown;
    const attempts = Array.isArray(parsed)
      ? parsed.filter(
          (value): value is number =>
            typeof value === "number" && value > now - LOGIN_ATTEMPT_WINDOW_MS,
        )
      : [];
    if (attempts.length >= LOGIN_ATTEMPT_LIMIT) return false;
    writeLocalStorage(LOGIN_ATTEMPT_KEY, JSON.stringify([...attempts, now]));
  } catch {
    // The in-memory cooldown still protects the button if storage is unavailable.
  }
  return true;
}

function googleProvider(selectAccount = false) {
  const provider = new GoogleAuthProvider();
  if (allowedDomain) {
    provider.setCustomParameters({
      hd: allowedDomain,
      ...(selectAccount ? { prompt: "select_account" } : {}),
    });
  } else if (selectAccount) {
    provider.setCustomParameters({ prompt: "select_account" });
  }
  return provider;
}

function loginError(error: unknown) {
  if (error instanceof GoogleIdentityError) {
    if (error.code === "popup_closed" || error.code === "access_denied")
      return "auth.theLoginWindowHasBeenClosedPleaseTryAgain";
    if (error.code === "popup_blocked") return "auth.popupBlocked";
    if (error.code === "timeout") return "auth.loginReplyTimedOut";
    if (error.code === "unavailable")
      return "auth.loginWidgetInitFailed";
  }
  if (error instanceof FirebaseError) {
    if (
      [
        "auth/missing-recaptcha-token",
        "auth/invalid-recaptcha-token",
        "auth/invalid-recaptcha-action",
        "auth/recaptcha-not-enabled",
      ].includes(error.code)
    )
      return "auth.appCheckFailed";
    if (error.code === "auth/network-request-failed")
      return "auth.connectionFailed";
    if (error.code === "auth/popup-closed-by-user")
      return "auth.theLoginWindowHasBeenClosedPleaseTryAgain";
    if (error.code === "auth/popup-blocked") return "auth.popupBlocked";
    if (error.code === "auth/operation-not-supported-in-this-environment")
      return "auth.systemBrowserRequired";
    if (error.code === "auth/unauthorized-domain")
      return "access.googleLoginOriginInvalid";
    if (
      error.code === "auth/argument-error" ||
      error.code === "auth/invalid-credential"
    )
      return "auth.loginWidgetInitFailed";
  }
  if (error instanceof Error && error.message === "app-check-not-configured") {
    return "auth.appCheckFailed";
  }
  return "auth.loginFailedPleaseTryAgainLater";
}

function signInWithGoogleIdToken(firebaseAuth: Auth, idToken: string) {
  return withRequestTimeout(
    () => signInWithCredential(firebaseAuth, GoogleAuthProvider.credential(idToken)),
    { label: "auth.loginVerification" },
  );
}

/** Finishes a sign-in that left the page for Google; returns an error key, or "" when none or done. */
export async function completeGoogleRedirectSignIn() {
  if (!auth || !googleClientId) return "";
  try {
    const idToken = takeGoogleRedirectResult(googleClientId);
    if (idToken) await signInWithGoogleIdToken(auth, idToken);
    return "";
  } catch (error) {
    sessionDebug("redirect login failed", error);
    return loginError(error);
  }
}

export async function loginWithGoogle(
  options: {
    selectAccount?: boolean;
    requestTurnstileToken?: (
      action: string,
      options?: { presentation?: "dialog" | "inline" },
    ) => Promise<string | null>;
  } = {},
) {
  if (!auth) return "auth.serviceUnavailable";
  if (!authEmulatorUrl && !googleClientId) return "auth.loginWidgetInitFailed";
  if (typeof navigator !== "undefined" && detectInAppBrowser(navigator.userAgent))
    return "auth.systemBrowserRequired";
  if (!claimLoginAttempt())
    return "auth.theLoginOperationIsTooFrequentPleaseTryAgainLater";

  const firebaseAuth = auth;
  try {
    if (!loginEntranceVerified()) {
      const preparationError = await prepareGoogleLoginEntrance({
        requestTurnstileToken: options.requestTurnstileToken,
      });
      if (preparationError) return preparationError;
    }
    if (authEmulatorUrl) {
      await signInWithPopup(
        firebaseAuth,
        googleProvider(Boolean(options.selectAccount)),
      );
      return "";
    }
    const hd = allowedDomain || undefined;
    let idToken: string;
    try {
      idToken = await requestGoogleIdToken({ clientId: googleClientId, hd });
    } catch (error) {
      if (!(error instanceof GoogleIdentityError) || error.code !== "popup_blocked") throw error;
      // The browser refused the popup; leave the page for Google and finish on return.
      startGoogleRedirect({ clientId: googleClientId, hd });
      return "";
    }
    await signInWithGoogleIdToken(firebaseAuth, idToken);
    return "";
  } catch (error) {
    sessionDebug("login failed", error);
    return loginError(error);
  }
}


export async function logoutFromFirebase() {
  if (!auth) return;
  const firebaseAuth = auth;
  // Silence the service worker before contacting the backend; offline logout must still be private.
  await revokeCurrentDevicePush().catch((error) => sessionDebug("push revocation failed", error));
  await withRequestTimeout(() => signOut(firebaseAuth), {
    label: "auth.signOutLabel",
  });
}
