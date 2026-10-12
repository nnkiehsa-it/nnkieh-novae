"use client";

import { Bell, GearSix, House, ListBullets, MagnifyingGlass, Sparkle } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { PrimaryNav, type NavItem } from "@/ui/nav";
import { GallerySections } from "./gallery-sections";

/** The primitives inside a stand-in shell: a dock on phones, a side rail on wide screens. */
export function Gallery() {
  const { t } = useI18n();
  const items: NavItem[] = [
    { href: "/ui-preview", icon: House, label: t("ui.nav.home") },
    { href: "/feed", icon: ListBullets, label: t("ui.nav.feed") },
    { badge: true, href: "/notifications", icon: Bell, label: t("ui.nav.notifications") },
    { href: "/settings", icon: GearSix, label: t("ui.nav.settings") },
  ];
  const nav = (variant: "dock" | "rail") => (
    <PrimaryNav activeHref="/ui-preview" items={items} label={t("ui.nav.primary")} variant={variant} />
  );

  return (
    <div className="md:pl-64">
      <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-58 flex-col rounded-panel p-3 shadow-panel md:flex">
        <div className="flex items-center gap-2 px-3 pb-6 pt-3 text-lg font-semibold"><Sparkle weight="fill" />Novae</div>
        {nav("rail")}
      </aside>
      <header className="flex items-center justify-between gap-3 px-[var(--gutter)] pt-[max(1rem,var(--safe-top))] md:hidden">
        <Button aria-label={t("ui.common.search")} size="icon"><MagnifyingGlass weight="bold" /></Button>
        <Avatar className="size-11" name="Tavric" />
      </header>
      <main className="mx-auto w-full max-w-6xl px-[var(--gutter)] pb-32 pt-6 md:pb-12">
        <GallerySections />
      </main>
      <div className="fixed inset-x-0 bottom-[var(--bottom-nav-gap)] z-30 mx-auto w-[min(26rem,calc(100%-2*var(--gutter)))] md:hidden">
        {nav("dock")}
      </div>
    </div>
  );
}
