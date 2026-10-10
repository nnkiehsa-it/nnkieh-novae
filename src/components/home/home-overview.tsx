"use client";

import { Block, BlockTitle } from "framework7-react";
import { MessageCircle, Megaphone, Wrench } from "lucide-react";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { PageHeader } from "@/components/ui/page-state";
import { HomeEntryList, type HomeEntry } from "./home-entry-list";
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
      icon: MessageCircle,
    }] : []),
    ...(categories.facilitiesEnabled ? [{
      href: "/feed?view=facilities",
      title: t("ui.home.facilitiesTitle"),
      icon: Wrench,
    }] : []),
    {
      href: "/feed?view=announcements",
      title: t("ui.home.latestAnnouncements"),
      icon: Megaphone,
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Novae" />
      <div className="mx-auto max-w-3xl space-y-6 pb-4 sm:space-y-8 md:pt-5">
        <section>
          <BlockTitle medium className="mx-0"><h2>{t("ui.home.startTitle")}</h2></BlockTitle>
          <Block className="m-0 px-0"><p>{t(descriptionKey)}</p></Block>
        </section>
        <HomeEntryList entries={entries} label={t("ui.nav.feed")} />
        <HomeStatusOverview />
      </div>
    </div>
  );
}
