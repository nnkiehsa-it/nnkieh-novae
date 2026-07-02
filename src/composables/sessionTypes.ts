import type { User } from 'firebase/auth';

export interface SessionState {
  initialized: boolean;
  loading: boolean;
  authChecking: boolean;
  userLoading: boolean;
  appInitializing: boolean;
  appReady: boolean;
  user: User | null;
  userRole: 'admin' | 'user';
  error: string;
}

export interface ValidationResult {
  ok: boolean;
  reason: string;
}
