"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { sessionDebug } from "@/lib/session-debug";
import { setPushSession } from "@/lib/push-session";
import { readLocalStorage, writeLocalStorage } from "@/lib/browser-storage";
import { readCachedAvatar, writeCachedAvatar } from "@/lib/avatar-cache";
import { clearContentEntityScope } from "@/lib/content-entity-store";
import { clearViewMemoryScope } from "@/lib/view-memory-cache";
import { restoreSessionDisplay } from "@/hooks/session-display-cache";
import { clearComposerDrafts } from "@/lib/composer-draft";
import { clearSupportedIssueMemory } from "@/lib/supported-issue-memory";
import { ensureBackendProfile } from "@/services/backend-auth";
import {
  readCachedSessionAccess,
  seedSessionAccess,
  type SessionAccess,
} from "@/services/session-role";
import {
  applyContentVersionsSnapshot,
  ensureContentVersionsFresh,
  resetContentVersionState,
} from "@/services/content-versions";
import { fetchSessionBootstrap } from "@/services/session-bootstrap";
import { stopContentRealtimeSession } from "@/services/realtime-events";
import {
  clearContentReadCache,
  clearContentReadMemoryCache,
  setContentCacheScope,
} from "@/services/content-read-cache";
import { clearResolvedUploadCache } from "@/services/uploads";
import { cacheUserAvatar } from "@/services/users-write";
import { seedNotificationUnreadHint } from "@/services/notifications";
import {
  clearCategoryCatalog,
  seedCategoryCatalog,
} from "@/hooks/use-categories";
import {
  consumePreparedLoginEntrance,
  verifyRestoredSession,
} from "@/services/session-auth";
import { ApiRequestError } from "@/lib/api-error";
import {
  validateBasicUser,
  validateUserAgainstToken,
  type ValidationResult,
} from "@/services/session-validation";
import { state, patch, type SessionState } from "@/hooks/session-state";
export { getSessionState, initialSessionState, patch, subscribe, type SessionState, type StartupPhase } from "@/hooks/session-state";

const VISIT_RECORD_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const VISIT_RECORDED_AT_KEY = "novae:platform-visit-recorded-at";
let booted = false;
let verificationSerial = 0;
let pendingAuthRejection = "";
let needsProfileSync = false;

function shouldRecordPlatformVisit(uid: string) {
  const recordedAt = Number.parseInt(
    readLocalStorage(`${VISIT_RECORDED_AT_KEY}:${uid}`) || "0",
    10,
  );
  return !(
    Number.isFinite(recordedAt) &&
    Date.now() - recordedAt < VISIT_RECORD_INTERVAL_MS
  );
}

function clearActiveSessionData() {
  clearComposerDrafts(state.user?.uid);
  void setPushSession(null).catch(() => undefined);
  clearContentEntityScope(state.user?.uid);
  clearViewMemoryScope(state.user?.uid);
  clearSupportedIssueMemory();
  stopContentRealtimeSession();
  clearCategoryCatalog();
  clearResolvedUploadCache();
  clearContentReadCache();
  resetContentVersionState();
}

function resetAccess(next: Partial<SessionState> = {}) {
  patch({
    customPhotoUrl: null,
    managedFacilityCategoryIds: [],
    managedIssueCategoryIds: [],
    permissions: [],
    roleLoading: false,
    roles: [],
    setupCompleted: false,
    startupError: "",
    userRole: "user",
    ...next,
  });
}

async function rejectUser(reason: string) {
  verificationSerial += 1;
  pendingAuthRejection = reason;
  clearActiveSessionData();
  resetAccess({ error: reason, user: null, appReady: true, initialized: true, loading: false, restoringSession: false });
  if (auth) await signOut(auth).catch(() => undefined);
}

async function loadAvatar(photoUrl: string, uid: string) {
  const cached = readCachedAvatar(uid, photoUrl);
  if (cached) {
    patch({ customPhotoUrl: cached });
    return;
  }
  try {
    const storedPhotoUrl = await cacheUserAvatar(photoUrl);
    if (state.user?.uid === uid && storedPhotoUrl) {
      writeCachedAvatar(uid, photoUrl, storedPhotoUrl);
      patch({ customPhotoUrl: storedPhotoUrl });
    }
  } catch {
    // Avatar persistence is optional and must not block session bootstrap.
  }
}

async function refreshVerifiedSession(
  user: User,
  verificationId: number,
  tokenValidationPromise: Promise<ValidationResult>,
  syncProfile: boolean,
  cachedAccessPromise: Promise<SessionAccess | null> = Promise.resolve(null),
  displaySnapshotPromise: Promise<void> = Promise.resolve(),
) {
  const current = () =>
    verificationId === verificationSerial && state.user?.uid === user.uid && auth?.currentUser === user;
  let accessReady = false;
  let receivedBootstrapAccess = false;
  try {
    const tokenValidation = await tokenValidationPromise;
    if (!current()) return;
    if (!tokenValidation.ok) return await rejectUser(tokenValidation.reason);
    patch({ startupPhase: syncProfile ? "profile" : "access" });
    if (syncProfile) {
      await ensureBackendProfile(user);
      if (!current()) return;
      needsProfileSync = false;
      patch({ startupPhase: "access" });
    }
    const applyAccess = (access: SessionAccess) => {
      accessReady = true;
      patch({
        managedFacilityCategoryIds: access.managedFacilityCategoryIds,
        managedIssueCategoryIds: access.managedIssueCategoryIds,
        permissions: access.permissions,
        roles: access.roles,
        roleLoading: false,
        setupCompleted: access.setupCompleted,
        startupPhase: "ready",
        userRole: access.role,
      });
    };
    const [cachedAccess] = await Promise.all([cachedAccessPromise, displaySnapshotPromise]);
    if (!current()) return;
    if (cachedAccess) applyAccess(cachedAccess);
    const bootstrap = await fetchSessionBootstrap({
      force: syncProfile,
      refresh: true,
      // Access opens the shell; catalog, unread and versions finish in the background.
      onAccess: (access) => {
        if (!current()) return;
        receivedBootstrapAccess = true;
        applyAccess(seedSessionAccess(access));
      },
      recordVisit: shouldRecordPlatformVisit(user.uid),
    });
    if (!current()) return;
    // A streamed access segment was already committed. Its optional tail must
    // not overwrite a newer role refresh made after the shell opened.
    if (!receivedBootstrapAccess) applyAccess(seedSessionAccess(bootstrap.access, { persist: false }));
    seedCategoryCatalog(bootstrap.catalog);
    applyContentVersionsSnapshot(bootstrap.versions);
    seedNotificationUnreadHint(bootstrap.notificationUnread.hasUnread);
    if (bootstrap.visitRecorded)
      writeLocalStorage(`${VISIT_RECORDED_AT_KEY}:${user.uid}`, String(Date.now()));
  } catch (error) {
    if (!current()) return;
    sessionDebug("session verification failed", error);
    if (error instanceof ApiRequestError && error.code === "account-restricted") {
      await rejectUser(error.restrictionMessage || error.message);
      return;
    }
    if (accessReady && !(error instanceof ApiRequestError && error.code === "app-check-failed")) return;
    patch({
      startupError: error instanceof ApiRequestError && error.code === "app-check-failed"
        ? "auth.appCheckFailed"
        : "auth.initializationFailed",
    });
  } finally {
    if (current()) {
      patch({ roleLoading: false, startupPhase: "ready" });
    }
  }
}

function acceptUser(
  user: User,
  tokenValidationPromise: Promise<ValidationResult>,
  syncProfile: boolean,
) {
  const verificationId = ++verificationSerial;
  needsProfileSync = syncProfile;
  setContentCacheScope(user.uid);
  clearContentReadMemoryCache();
  const cachedAccessPromise = syncProfile ? Promise.resolve(null) : readCachedSessionAccess();
  const displaySnapshotPromise = restoreSessionDisplay(user.uid, () => verificationId === verificationSerial && auth?.currentUser === user);
  patch({
    appReady: true,
    authChecking: false,
    error: "",
    initialized: true,
    loading: false,
    managedFacilityCategoryIds: [],
    managedIssueCategoryIds: [],
    permissions: [],
    roleLoading: true,
    roles: [],
    setupCompleted: false,
    startupError: "",
    startupPhase: "account",
    user,
    userRole: "user",
  });
  if (user.photoURL) void loadAvatar(user.photoURL, user.uid);
  void refreshVerifiedSession(user, verificationId, tokenValidationPromise, syncProfile, cachedAccessPromise, displaySnapshotPromise);
}

export async function retrySessionStartup() {
  const user = state.user;
  if (!user || state.roleLoading) return;
  const verificationId = ++verificationSerial;
  patch({ roleLoading: true, startupError: "", startupPhase: "account", startupRun: state.startupRun + 1, startupSteps: ["account"] });
  await refreshVerifiedSession(user, verificationId, validateUserAgainstToken(user), needsProfileSync);
}

export async function initializeSession(
  requestTurnstileToken?: (
    action: string,
    options?: { presentation?: "dialog" | "inline" },
  ) => Promise<string | null>,
) {
  if (booted || typeof window === "undefined") return;
  booted = true;
  if (!auth) {
    patch({
      appReady: true,
      authChecking: false,
      error: "auth.serviceUnavailable",
      initialized: true,
      loading: false,
    });
    return;
  }
  // Local auto-login replaces a restored Firebase User, even for the same UID.
  // Finish it before observing auth so bootstrap never races that replacement.
  if (process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH === "true") {
    try {
      const { signInForE2e } = await import("@/testing/e2e-auth");
      await signInForE2e(process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH_EMAIL || "admin@integration.invalid");
    } catch (error) {
      sessionDebug("local auto-login failed", error);
      patch({ appReady: true, initialized: true, loading: false, error: "auth.serviceUnavailable" });
      return;
    }
  }
  onAuthStateChanged(
    auth,
    async (user) => {
      if (auth?.currentUser !== user) return;
      const authEvent = ++verificationSerial;
      if (state.user && user && state.user.uid !== user.uid) clearActiveSessionData();
      const authEventError = user ? "" : pendingAuthRejection;
      pendingAuthRejection = "";
      patch({ authChecking: false, error: authEventError, loading: true, restoringSession: false, startupError: "", startupPhase: "session" });
      if (!user) {
        clearActiveSessionData();
        resetAccess({
          appReady: true,
          error: authEventError,
          initialized: true,
          loading: false,
          user: null,
        });
        return;
      }
      const validation = validateBasicUser(user);
      if (!validation.ok) {
        await rejectUser(validation.reason);
        return;
      }
      const tokenValidationPromise = validateUserAgainstToken(user);
      void tokenValidationPromise.catch(() => undefined);
      const freshLogin = consumePreparedLoginEntrance();
      if (!freshLogin) {
        patch({ restoringSession: true, startupPhase: "security" });
        const restorationError = await verifyRestoredSession({
          requestTurnstileToken,
        });
        if (authEvent !== verificationSerial || auth?.currentUser !== user) return;
        if (restorationError) {
          await rejectUser(restorationError);
          return;
        }
        patch({ restoringSession: false, startupPhase: "account" });
      }
      acceptUser(user, tokenValidationPromise, freshLogin);
    },
    (error) => {
      sessionDebug("auth observer failed", error);
      patch({
        appReady: true,
        authChecking: false,
        error: "auth.failedToLoadLoginStatusPleaseTryAgainLater",
        initialized: true,
        loading: false,
      });
    },
  );
  const resync = () =>
    void ensureContentVersionsFresh({ notify: true }).catch(() => undefined);
  window.addEventListener("online", resync);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resync();
  });
}
