export type ThemePreference = "system" | "light" | "dark";

/* The stored choice; "system" is stored as no value at all. */
const STORAGE_KEY = "theme";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

/**
 * Runs in <head> before first paint and sets `data-theme` on the root to the
 * theme in force, resolving "system" from the device, so nothing flashes.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${STORAGE_KEY}");document.documentElement.dataset.theme=t==="light"||t==="dark"?t:matchMedia("${LIGHT_QUERY}").matches?"light":"dark"}catch(e){}`;

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function apply(preference: ThemePreference) {
  document.documentElement.dataset.theme = preference === "system"
    ? (matchMedia(LIGHT_QUERY).matches ? "light" : "dark")
    : preference;
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Private mode: the choice lasts for this visit only.
  }
  apply(preference);
}

/** Follows the device while the preference is "system". Returns the cleanup. */
export function watchSystemTheme() {
  const query = matchMedia(LIGHT_QUERY);
  const onChange = () => { if (readThemePreference() === "system") apply("system"); };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
