"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { allowedDomain } from "@/lib/firebase";
import {
  canManageFacilityCategory,
  canManageIssueCategory,
  hasPermission,
  hasRole,
} from "@/lib/session-access";
import {
  fetchCurrentUserRole,
  type PermissionCode,
} from "@/services/session-role";
import {
  loginWithGoogle,
  prepareGoogleLoginEntrance,
  logoutFromFirebase,
} from "@/services/session-auth";
import {
  getSessionState,
  initialSessionState,
  initializeSession,
  patch,
  subscribe,
} from "@/hooks/session-store";
import { useTurnstile } from "@/components/turnstile-provider";

export function SessionProvider({ children }: { children: ReactNode }) {
  const { requestToken } = useTurnstile();
  useEffect(() => initializeSession(requestToken), [requestToken]);
  return children;
}

export function useSession() {
  const { requestToken } = useTurnstile();
  const snapshot = useSyncExternalStore(
    subscribe,
    getSessionState,
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
  };
}
