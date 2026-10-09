"use client";
import { createContext } from "react";
export const NativePageHeaderHost = createContext<HTMLElement | null | undefined>(undefined);
export const NativeNavbarHost = createContext<HTMLElement | null>(null);
export const NativeNavbarRegistration = createContext<((navbar: HTMLElement | null) => void) | null>(null);
