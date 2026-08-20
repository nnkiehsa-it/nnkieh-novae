"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, allowedDomain } from "@/lib/firebase";
import {
  canManageFacilityCategory,
  canManageIssueCategory,
  hasPermission,
  hasRole,
} from "@/lib/session-access";
import { sessionDebug } from "@/lib/session-debug";
import { readLocalStorage, writeLocalStorage } from "@/lib/browser-storage";
import { clearContentEntityScope } from "@/lib/content-entity-store";
import { clearViewMemoryScope } from "@/lib/view-memory-cache";
import { ensureBackendProfile } from "@/services/backend-auth";
import {
  fetchCurrentUserRole,
  seedSessionAccess,
  type PermissionCode,
  type RoleCode,
} from "@/services/session-role";
import {
  applyContentVersionsSnapshot,
  ensureContentVersionsFresh,
  resetContentVersionState,
} from "@/services/content-versions";
import { fetchSessionBootstrap } from "@/services/session-bootstrap";
import {
  startContentRealtimeSession,
  stopContentRealtimeSession,
} from "@/services/realtime-events";
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
  ensureCategoryCatalog,
  seedCategoryCatalog,
} from "@/hooks/use-categories";
import {
  consumePreparedLoginEntrance,
  loginWithGoogle,
  logoutFromFirebase,
  prepareGoogleLoginEntrance,
  verifyRestoredSession,
} from "@/services/session-auth";
import { useTurnstile } from "@/components/turnstile-provider";
import { ApiRequestError } from "@/lib/api-error";
import {
  validateBasicUser,
  validateUserAgainstToken,
} from "@/services/session-validation";

const VISIT_RECORD_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const VISIT_RECORDED_AT_KEY = "novae:platform-visit-recorded-at";

interface SessionState {
  appReady: boolean;
  authChecking: boolean;
  customPhotoUrl: string | null;
  error: string;
  initialized: boolean;
  loading: boolean;
  managedFacilityCategoryIds: string[];
  managedIssueCategoryIds: string[];
  mySupportedIssueIds: Set<string>;
  permissions: PermissionCode[];
  roleLoading: boolean;
  roles: RoleCode[];
  setupCompleted: boolean;
  user: User | null;
  userRole: "admin" | "user";
}

const listeners = new Set<() => void>();
const initialSessionState: SessionState = {
  appReady: false,
  authChecking: true,
  customPhotoUrl: null,
  error: "",
  initialized: false,
  loading: true,
  managedFacilityCategoryIds: [],
  managedIssueCategoryIds: [],
  mySupportedIssueIds: new Set(),
  permissions: [],
  roleLoading: false,
  roles: [],
  setupCompleted: false,
  user: null,
  userRole: "user",
};
let state: SessionState = initialSessionState;
let booted = false;
let verificationSerial = 0;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function patch(next: Partial<SessionState>) {
  state = { ...state, ...next };
  emit();
}

function shouldRecordPlatformVisit() {
  const recordedAt = Number.parseInt(
    readLocalStorage(VISIT_RECORDED_AT_KEY) || "0",
    10,
  );
  return !(
    Number.isFinite(recordedAt) &&
    Date.now() - recordedAt < VISIT_RECORD_INTERVAL_MS
  );
}

function clearActiveSessionData() {
  clearContentEntityScope(state.user?.uid);
  clearViewMemoryScope(state.user?.uid);
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
    mySupportedIssueIds: new Set(),
    permissions: [],
    roleLoading: false,
    roles: [],
    setupCompleted: false,
    userRole: "user",
    ...next,
  });
}

async function rejectUser(reason: string) {
  verificationSerial += 1;
  clearActiveSessionData();
  resetAccess({ error: reason, user: null });
  if (auth) await signOut(auth).catch(() => undefined);
}

async function loadAvatar(photoUrl: string, uid: string) {
  try {
    const storedPhotoUrl = await cacheUserAvatar(photoUrl);
    if (state.user?.uid === uid && storedPhotoUrl)
      patch({ customPhotoUrl: storedPhotoUrl });
  } catch {
    // Avatar persistence is optional and must not block session bootstrap.
  }
}

async function refreshVerifiedSession(
  user: User,
  verificationId: number,
) {
  const current = () =>
    verificationId === verificationSerial && state.user?.uid === user.uid;
  try {
    const tokenValidation = await validateUserAgainstToken(user);
    if (!current()) return;
    if (!tokenValidation.ok) return await rejectUser(tokenValidation.reason);
    await ensureBackendProfile(user);
    if (!current()) return;
    try {
      const bootstrap = await fetchSessionBootstrap({
        force: true,
        recordVisit: shouldRecordPlatformVisit(),
      });
      if (!current()) return;
      const access = seedSessionAccess(bootstrap.access);
      seedCategoryCatalog(bootstrap.catalog);
      applyContentVersionsSnapshot(bootstrap.versions);
      seedNotificationUnreadHint(bootstrap.notificationUnread.hasUnread);
      if (bootstrap.visitRecorded)
        writeLocalStorage(VISIT_RECORDED_AT_KEY, String(Date.now()));
      patch({
        managedFacilityCategoryIds: access.managedFacilityCategoryIds,
        managedIssueCategoryIds: access.managedIssueCategoryIds,
        permissions: access.permissions,
        roles: access.roles,
        setupCompleted: access.setupCompleted,
        userRole: access.role,
      });
    } catch (bootstrapError) {
      sessionDebug("bootstrap fallback", bootstrapError);
      await ensureContentVersionsFresh().catch(() => undefined);
      if (!current()) return;
      const access = await fetchCurrentUserRole(true, { useBootstrap: false });
      if (!current()) return;
      patch({
        managedFacilityCategoryIds: access.managedFacilityCategoryIds,
        managedIssueCategoryIds: access.managedIssueCategoryIds,
        permissions: access.permissions,
        roles: access.roles,
        setupCompleted: access.setupCompleted,
        userRole: access.role,
      });
      await ensureCategoryCatalog().catch(() => undefined);
    }
  } catch (error) {
    if (!current()) return;
    sessionDebug("session verification failed", error);
    patch({
      error: error instanceof ApiRequestError && error.code === "app-check-failed"
        ? "auth.appCheckFailed"
        : "auth.initializationFailed",
    });
  } finally {
    if (current()) {
      patch({ roleLoading: false });
      startContentRealtimeSession();
    }
  }
}

function acceptUser(user: User) {
  const verificationId = ++verificationSerial;
  setContentCacheScope(user.uid);
  clearContentReadMemoryCache();
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
    user,
    userRole: "user",
  });
  if (user.photoURL) void loadAvatar(user.photoURL, user.uid);
  void refreshVerifiedSession(user, verificationId);
}

export function initializeSession(
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
  onAuthStateChanged(
    auth,
    async (user) => {
      patch({ authChecking: false, error: "", loading: true });
      if (!user) {
        verificationSerial += 1;
        clearActiveSessionData();
        resetAccess({
          appReady: true,
          initialized: true,
          loading: false,
          user: null,
        });
        return;
      }
      const validation = validateBasicUser(user);
      if (!validation.ok) {
        await rejectUser(validation.reason);
        patch({ appReady: true, initialized: true, loading: false });
        return;
      }
      if (!consumePreparedLoginEntrance()) {
        const restorationError = await verifyRestoredSession({
          requestTurnstileToken,
        });
        if (restorationError) {
          await rejectUser(restorationError);
          patch({ appReady: true, initialized: true, loading: false });
          return;
        }
      }
      acceptUser(user);
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const { requestToken } = useTurnstile();
  useEffect(() => initializeSession(requestToken), [requestToken]);
  return children;
}

export function useSession() {
  const { requestToken } = useTurnstile();
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => initialSessionState,
  );
  const accessPolicy = useMemo(
    () => ({
      managedFacilityCategoryIds: snapshot.managedFacilityCategoryIds,
      managedIssueCategoryIds: snapshot.managedIssueCategoryIds,
      permissions: snapshot.permissions,
      roles: snapshot.roles,
    }),
    [
      snapshot.managedFacilityCategoryIds,
      snapshot.managedIssueCategoryIds,
      snapshot.permissions,
      snapshot.roles,
    ],
  );

  const can = useCallback(
    (permission: PermissionCode) => hasPermission(accessPolicy, permission),
    [accessPolicy],
  );
  const canManageFacilityCategoryForSession = useCallback(
    (categoryId: string) => canManageFacilityCategory(accessPolicy, categoryId),
    [accessPolicy],
  );
  const canManageIssueCategoryForSession = useCallback(
    (categoryId: string) => canManageIssueCategory(accessPolicy, categoryId),
    [accessPolicy],
  );
  const login = useCallback(
    async (options?: { selectAccount?: boolean }) => {
      patch({ error: "", loading: true });
      const error = await loginWithGoogle({
        ...options,
        requestTurnstileToken: requestToken,
      });
      patch({ error, loading: false });
    },
    [requestToken],
  );
  const prepareLogin = useCallback(async () => {
    return await prepareGoogleLoginEntrance({ requestTurnstileToken: requestToken });
  }, [requestToken]);

  const logout = useCallback(async () => {
    patch({ loading: true });
    try {
      await logoutFromFirebase();
    } finally {
      patch({ loading: false });
    }
  }, []);
  const refreshSessionAccess = useCallback(async () => {
    if (!snapshot.user) return;
    const access = await fetchCurrentUserRole(true);
    patch({
      managedFacilityCategoryIds: access.managedFacilityCategoryIds,
      managedIssueCategoryIds: access.managedIssueCategoryIds,
      permissions: access.permissions,
      roles: access.roles,
      setupCompleted: access.setupCompleted,
      userRole: access.role,
    });
    return access;
  }, [snapshot.user]);
  const setSupportedIssue = useCallback(
    (issueId: string, supported: boolean) => {
      const next = new Set(state.mySupportedIssueIds);
      if (supported) next.add(issueId);
      else next.delete(issueId);
      patch({ mySupportedIssueIds: next });
    },
    [],
  );

  return {
    ...snapshot,
    allowedDomain,
    can,
    canManageFacilityCategory: canManageFacilityCategoryForSession,
    canManageIssueCategory: canManageIssueCategoryForSession,
    isAdmin: hasRole(accessPolicy, "platform-admin"),
    isAllowedUser: Boolean(snapshot.user),
    loginBusy:
      snapshot.loading ||
      snapshot.authChecking ||
      (Boolean(snapshot.user) && snapshot.roleLoading),
    login,
    prepareLogin,
    logout,
    refreshSessionAccess,
    setSupportedIssue,
  };
}
