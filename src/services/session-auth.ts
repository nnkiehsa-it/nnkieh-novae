import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, allowedDomain } from "@/lib/firebase";
import {
  GoogleIdentityError,
  requestGoogleAccessToken,
} from "@/lib/google-identity";
import { readLocalStorage, writeLocalStorage } from "@/lib/browser-storage";
import { withRequestTimeout } from "@/lib/request";
import { sessionDebug } from "@/lib/session-debug";
import { detectInAppBrowser } from "@/lib/in-app-browser";


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
    if (error.code === "script_load_failed" || error.code === "unavailable")
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

export async function loginWithGoogle(
  options: { selectAccount?: boolean } = {},
) {
  if (!auth) return "auth.serviceUnavailable";
  if (!authEmulatorUrl && !googleClientId) return "auth.loginWidgetInitFailed";
  if (typeof navigator !== "undefined" && detectInAppBrowser(navigator.userAgent))
    return "auth.systemBrowserRequired";
  if (!claimLoginAttempt())
    return "auth.theLoginOperationIsTooFrequentPleaseTryAgainLater";

  const firebaseAuth = auth;
  try {
    if (authEmulatorUrl) {
      await signInWithPopup(
        firebaseAuth,
        googleProvider(Boolean(options.selectAccount)),
      );
      return "";
    }
    const accessToken = await requestGoogleAccessToken({
      clientId: googleClientId,
      hd: allowedDomain || undefined,
    });
    await withRequestTimeout(
      () => signInWithCredential(
        firebaseAuth,
        GoogleAuthProvider.credential(null, accessToken),
      ),
      { label: "auth.loginVerification" },
    );
    return "";
  } catch (error) {
    sessionDebug("login failed", error);
    return loginError(error);
  }
}


export async function logoutFromFirebase() {
  if (!auth) return;
  const firebaseAuth = auth;
  await withRequestTimeout(() => signOut(firebaseAuth), {
    label: "auth.signOutLabel",
  });
}
