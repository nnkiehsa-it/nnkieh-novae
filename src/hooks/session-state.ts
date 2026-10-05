"use client";

import type { User } from "firebase/auth";
import type { PermissionCode, RoleCode } from "@/services/session-role";

export type StartupPhase = "session" | "security" | "account" | "profile" | "access" | "content" | "ready";

export interface SessionState {
  appReady: boolean;
  authChecking: boolean;
  customPhotoUrl: string | null;
  error: string;
  initialized: boolean;
  loading: boolean;
  managedFacilityCategoryIds: string[];
  managedIssueCategoryIds: string[];
  permissions: PermissionCode[];
  roleLoading: boolean;
  restoringSession: boolean;
  roles: RoleCode[];
  setupCompleted: boolean;
  startupError: string;
  startupPhase: StartupPhase;
  startupRun: number;
  startupSteps: readonly StartupPhase[];
  user: User | null;
  userRole: "admin" | "user";
}

export const initialSessionState: SessionState = {
  appReady: false, authChecking: true, customPhotoUrl: null, error: "", initialized: false,
  loading: true, managedFacilityCategoryIds: [], managedIssueCategoryIds: [], permissions: [],
  roleLoading: false, restoringSession: false, roles: [], setupCompleted: false,
  startupError: "", startupPhase: "session", startupRun: 0, startupSteps: ["session"], user: null, userRole: "user",
};

const listeners = new Set<() => void>();
export let state: SessionState = initialSessionState;

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function patch(next: Partial<SessionState>) {
  const startupSteps = next.startupSteps ?? (next.startupPhase === "session"
    ? ["session"] as const
    : next.startupPhase && next.startupPhase !== state.startupPhase
      ? [...state.startupSteps, next.startupPhase]
      : state.startupSteps);
  state = {
    ...state,
    ...next,
    startupRun: next.startupRun ?? (next.startupPhase === "session" ? state.startupRun + 1 : state.startupRun),
    startupSteps,
  };
  listeners.forEach((listener) => listener());
}

export function getSessionState() { return state; }
