import {
  readLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from "@/lib/browser-storage";

export const ACCENT_THEME_STORAGE_KEY = "novae-accent-theme";
export const DEFAULT_ACCENT_LIGHT = "#171717";
export const DEFAULT_ACCENT_DARK = "#F1F1F1";

export const ACCENT_PRESETS = [
  { color: "#F43F5E", name: "Rose" },
  { color: "#D946EF", name: "Fuchsia" },
  { color: "#8B5CF6", name: "Violet" },
  { color: "#6366F1", name: "Indigo" },
  { color: "#3B82F6", name: "Blue" },
  { color: "#06B6D4", name: "Cyan" },
  { color: "#10B981", name: "Emerald" },
  { color: "#84CC16", name: "Lime" },
  { color: "#F59E0B", name: "Amber" },
  { color: "#F97316", name: "Orange" },
] as const;

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/iu;

export function normalizeAccentColor(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HEX_PATTERN.test(trimmed)) return null;
  if (trimmed.length === 4) {
    const [r, g, b] = trimmed.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return trimmed.toUpperCase();
}

function channelToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = channelToLinear((value >> 16) & 255);
  const green = channelToLinear((value >> 8) & 255);
  const blue = channelToLinear(value & 255);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function blendHex(from: string, to: string, amount: number) {
  const fromValue = Number.parseInt(from.slice(1), 16);
  const toValue = Number.parseInt(to.slice(1), 16);
  const channels = [16, 8, 0].map((shift) => {
    const start = (fromValue >> shift) & 255;
    const end = (toValue >> shift) & 255;
    return Math.round(start + (end - start) * amount);
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function accentForeground(hex: string) {
  const normalized = normalizeAccentColor(hex);
  if (!normalized) return "#FFFFFF";
  const luminance = relativeLuminance(normalized);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkLuminance = relativeLuminance("#0D0D0D");
  const darkContrast = (luminance + 0.05) / (darkLuminance + 0.05);
  return darkContrast >= whiteContrast ? "#0D0D0D" : "#FFFFFF";
}

export function accentContentColor(
  hex: string,
  background: string,
  contrastTarget: string,
) {
  const normalized = normalizeAccentColor(hex);
  const normalizedBackground = normalizeAccentColor(background);
  const normalizedTarget = normalizeAccentColor(contrastTarget);
  if (!normalized || !normalizedBackground || !normalizedTarget) {
    return normalizedTarget ?? "#FFFFFF";
  }
  if (contrastRatio(normalized, normalizedBackground) >= 4.5) return normalized;

  for (let step = 1; step <= 20; step += 1) {
    const candidate = blendHex(normalized, normalizedTarget, step / 20);
    if (contrastRatio(candidate, normalizedBackground) >= 4.5) return candidate;
  }
  return normalizedTarget;
}

export function readAccentColor() {
  return normalizeAccentColor(readLocalStorage(ACCENT_THEME_STORAGE_KEY));
}

export function persistAccentColor(color: string | null) {
  const normalized = normalizeAccentColor(color);
  if (!normalized) {
    removeLocalStorage(ACCENT_THEME_STORAGE_KEY);
    return null;
  }
  writeLocalStorage(ACCENT_THEME_STORAGE_KEY, normalized);
  return normalized;
}

export function applyAccentColor(color: string | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const normalized = normalizeAccentColor(color);

  if (!normalized) {
    root.style.removeProperty("--theme-accent");
    root.style.removeProperty("--theme-accent-foreground");
    root.style.removeProperty("--theme-accent-content-light");
    root.style.removeProperty("--theme-accent-content-dark");
    root.removeAttribute("data-accent-theme");
    return;
  }

  root.style.setProperty("--theme-accent", normalized);
  root.style.setProperty("--theme-accent-foreground", accentForeground(normalized));
  root.style.setProperty(
    "--theme-accent-content-light",
    accentContentColor(normalized, "#FDFDFD", "#0D0D0D"),
  );
  root.style.setProperty(
    "--theme-accent-content-dark",
    accentContentColor(normalized, "#121212", "#F3F3F3"),
  );
  root.setAttribute("data-accent-theme", "custom");
}
