import type { User } from 'firebase/auth';
import type { PermissionCode, RoleCode } from '@/services/session-role';

export interface SessionState {
  initialized: boolean;
  loading: boolean;
  authChecking: boolean;
  userLoading: boolean;
  appInitializing: boolean;
  appReady: boolean;
  roleLoading: boolean;
  user: User | null;
  userRole: 'admin' | 'user';
  roles: RoleCode[];
  permissions: PermissionCode[];
  managedIssueCategoryIds: string[];
  managedFacilityCategoryIds: string[];
  setupCompleted: boolean;
  error: string;
}

export interface ValidationResult {
  ok: boolean;
  reason: string;
}
