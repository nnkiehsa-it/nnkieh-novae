"use client";

import Image from "next/image";
import { MessageCircle, Megaphone, Wrench } from "lucide-react";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { PageHeader } from "@/components/ui/page-state";
import { HomeEntryGrid, type HomeEntry } from "./home-entry-grid";
import { HomeStatusOverview } from "./home-status-overview";

export function HomeOverview() {
  const { t } = useI18n();
  const categories = useCategories();
  const supportsEnabled = categories.activeIssueCategories.some((category) => category.supportEnabled);
  const descriptionKey = categories.issuesEnabled
    ? supportsEnabled ? "ui.home.startDescription" : "ui.home.ideaDescription"
    : categories.facilitiesEnabled ? "ui.home.reportIntro" : "ui.home.announcementsIntro";
  const entries: HomeEntry[] = [
    ...(categories.issuesEnabled ? [{
      href: "/feed",
      title: t("ui.nav.issues"),
      description: t(supportsEnabled ? "ui.home.proposalsDescription" : "ui.home.ideasDescription"),
      icon: MessageCircle,
    }] : []),
    ...(categories.facilitiesEnabled ? [{
      href: "/feed?view=facilities",
      title: t("ui.home.facilitiesTitle"),
      description: t("ui.home.reportDescription"),
      icon: Wrench,
    }] : []),
    {
      href: "/feed?view=announcements",
      title: t("ui.home.latestAnnouncements"),
      description: t("ui.home.announcementsDescription"),
      icon: Megaphone,
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Novae" />
      <div className="mx-auto max-w-3xl space-y-6 pb-4 sm:space-y-8 md:pt-5">
        <section>
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="min-w-0 flex-1 space-y-3">
              <h2 className="text-balance text-[1.75rem] font-semibold leading-tight tracking-[-0.035em] sm:text-3xl">{t("ui.home.startTitle")}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{t(descriptionKey)}</p>
            </div>
            <Image alt="" aria-hidden src="/home-start.webp" width={384} height={384} sizes="(max-width: 639px) 96px, 128px" loading="eager" className="h-auto w-24 shrink-0 dark:invert sm:w-32" />
          </div>
        </section>
        <HomeEntryGrid entries={entries} label={t("ui.nav.feed")} />
        <HomeStatusOverview />
      </div>
    </div>
  );
}
