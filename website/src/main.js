import zh from "../content/zh.json";
import en from "../content/en.json";
import "./site.css";

const catalogs = { zh, en };
const storageKey = "novae-website-language";
const toggle = document.querySelector(".language");

function preferredLanguage() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // The page remains usable when storage is unavailable.
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function applyLanguage(language) {
  const next = language === "en" ? "en" : "zh";
  const messages = catalogs[next];
  document.documentElement.lang = next === "zh" ? "zh-Hant" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = messages[element.dataset.i18n];
    if (value) element.textContent = value;
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    const value = messages[element.dataset.i18nAlt];
    if (value) element.setAttribute("alt", value);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
    const value = messages[element.dataset.i18nAria];
    if (value) element.setAttribute("aria-label", value);
  });
  document.title = messages["about.meta.title"];
  document.querySelector('meta[name="description"]')?.setAttribute("content", messages["about.meta.description"]);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", messages["about.meta.title"]);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", messages["about.meta.description"]);
  if (toggle) {
    toggle.textContent = messages["about.language.short"];
    toggle.setAttribute("aria-label", messages["about.language"]);
  }
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    // Language still changes for this visit.
  }
}

toggle?.addEventListener("click", () => applyLanguage(document.documentElement.lang === "en" ? "zh" : "en"));
applyLanguage(preferredLanguage());

const route = document.querySelector(".route");
if (route) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    route.dataset.visible = "true";
  } else {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      route.dataset.visible = "true";
      observer.disconnect();
    }, { threshold: 0.28 });
    observer.observe(route);
  }
}
