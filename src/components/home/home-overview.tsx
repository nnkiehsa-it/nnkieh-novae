"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Blocks, Megaphone, Plus, Wrench } from "lucide-react";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { getDefaultIssueRouteFilter } from "@/constants/categories";
import { PageHeader } from "@/components/ui/page-state";
import { Button } from "@/components/ui/button";

export function HomeOverview() {
  const { t } = useI18n();
  const categories = useCategories();
  const proposalHref = `/issues/${encodeURIComponent(getDefaultIssueRouteFilter())}/compose/new`;
  const supportsEnabled = categories.activeIssueCategories.some((category) => category.supportEnabled);
  const titleKey = categories.issuesEnabled ? "ui.home.startTitle"
    : categories.facilitiesEnabled ? "ui.home.reportTitle" : "ui.home.announcementsTitle";
  const descriptionKey = categories.issuesEnabled
    ? supportsEnabled ? "ui.home.startDescription" : "ui.home.ideaDescription"
    : categories.facilitiesEnabled ? "ui.home.reportIntro" : "ui.home.announcementsIntro";
  const primaryHref = categories.issuesEnabled ? "/feed"
    : categories.facilitiesEnabled ? "/feed?view=facilities" : "/feed?view=announcements";
  const primaryLabel = categories.issuesEnabled ? "ui.home.browseProposals"
    : categories.facilitiesEnabled ? "ui.home.facilities" : "ui.home.readAnnouncements";
  const showOtherWays = categories.issuesEnabled || categories.facilitiesEnabled;
  return (
    <div className="space-y-6">
      <PageHeader title={t("ui.nav.home")} />
      <div className={`grid gap-8 pb-4 md:gap-12 md:pt-5 ${showOtherWays ? "md:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]" : "max-w-2xl"}`}>
        <section className="space-y-5">
          <div className="flex max-w-lg items-start gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <h2 className="text-balance text-[1.75rem] font-semibold leading-tight tracking-[-0.035em] sm:text-3xl">{t(titleKey)}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{t(descriptionKey)}</p>
            </div>
            <Image alt="" aria-hidden src="/home-start.webp" width={384} height={384} sizes="(max-width: 639px) 96px, 128px" loading="eager" className="h-auto w-24 shrink-0 dark:invert sm:w-32" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="lg">
              <Link href={primaryHref} prefetch={false}>{categories.issuesEnabled ? <Blocks /> : categories.facilitiesEnabled ? <Wrench /> : <Megaphone />}{t(primaryLabel)}</Link>
            </Button>
            {showOtherWays ? <Button asChild variant="ghost">
              <Link href={categories.issuesEnabled ? proposalHref : "/facilities/new"} prefetch={false}><Plus />{t(categories.issuesEnabled ? "ui.home.propose" : "ui.home.report")}</Link>
            </Button> : null}
          </div>
        </section>
        {showOtherWays ? <section aria-label={t("ui.home.otherWays")} className="divide-y border-y">
          {categories.issuesEnabled && categories.facilitiesEnabled ? <Link href="/feed?view=facilities" prefetch={false}
            className="group flex items-start gap-3 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Wrench className="mt-1 size-5 shrink-0 text-[var(--tint-content)]" />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block text-base font-semibold">{t("ui.home.facilities")}</span>
              <span className="block text-sm leading-6 text-muted-foreground">{t("ui.home.reportDescription")}</span>
            </span>
            <ArrowRight className="mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-1" />
          </Link> : null}
          <Link href="/feed?view=announcements" prefetch={false}
            className="group flex items-start gap-3 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Megaphone className="mt-1 size-5 shrink-0 text-[var(--tint-content)]" />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block text-base font-semibold">{t("ui.home.readAnnouncements")}</span>
              <span className="block text-sm leading-6 text-muted-foreground">{t("ui.home.announcementsDescription")}</span>
            </span>
            <ArrowRight className="mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-1" />
          </Link>
        </section> : null}
      </div>
    </div>
  );
}
