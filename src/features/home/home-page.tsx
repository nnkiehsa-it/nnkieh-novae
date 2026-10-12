"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Lightbulb, Megaphone, Wrench } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useHomeStatusCounts } from "@/hooks/use-home-status-counts";
import { useSession } from "@/hooks/use-session";
import { feedHref } from "@/lib/feed-href";
import { AnnouncementNotice } from "@/features/announcements/announcement-notice";
import { Panel, SectionTitle } from "@/ui/panel";
import { PageHeader } from "@/ui/page";
import { StatusOverview } from "./status-overview";
import { TodoCards } from "./todo-cards";

interface Destination { href: string; icon: Icon; title: string }

export function HomePage() {
  const { t } = useI18n();
  const session = useSession();
  const categories = useCategories();
  const counts = useHomeStatusCounts();
  const supportsEnabled = categories.activeIssueCategories.some((category) => category.supportEnabled);
  const descriptionKey = categories.issuesEnabled
    ? supportsEnabled ? "ui.home.startDescription" : "ui.home.ideaDescription"
    : categories.facilitiesEnabled ? "ui.home.reportIntro" : "ui.home.announcementsIntro";
  const destinations: Destination[] = [
    ...(categories.issuesEnabled ? [{ href: feedHref("issues"), icon: Lightbulb, title: t("ui.nav.issues") }] : []),
    ...(categories.facilitiesEnabled ? [{ href: feedHref("facilities"), icon: Wrench, title: t("ui.home.facilitiesTitle") }] : []),
    { href: feedHref("announcements"), icon: Megaphone, title: t("ui.home.latestAnnouncements") },
  ];

  return (
    <div className="grid gap-8">
      <PageHeader actions={<AnnouncementNotice />} description={session.user?.displayName ?? undefined} title="Novae" />
      {/* Phones read top to bottom: what is waiting, the start panel, where to go,
          then the figures. A wide screen keeps the first and last in a narrow
          column beside the other two. */}
      <div className="grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <div className="contents lg:grid lg:gap-8">
          <TodoCards counts={counts} />
          <div className="order-last lg:order-none"><StatusOverview counts={counts} /></div>
        </div>
        <div className="contents lg:grid lg:gap-6">
          <Panel className="flex items-center gap-5 p-6 sm:gap-8">
            <div className="min-w-0 flex-1">
              <h2 className="text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-[1.75rem]">{t("ui.home.startTitle")}</h2>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{t(descriptionKey)}</p>
            </div>
            <Image alt="" aria-hidden className="h-auto w-24 shrink-0 invert sm:w-32" height={384} loading="eager" sizes="(max-width: 639px) 96px, 128px" src="/home-start.webp" width={384} />
          </Panel>
          <nav aria-label={t("ui.nav.feed")} className="grid gap-3">
            <SectionTitle>{t("ui.nav.feed")}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {destinations.map(({ href, icon: DestinationIcon, title }) => (
                <Panel asChild className="group flex items-center gap-4" interactive key={href}>
                  <Link href={href} prefetch={false}>
                    <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-contrast text-on-contrast">
                      <DestinationIcon className="size-5" weight="bold" />
                    </span>
                    <span className="min-w-0 flex-1 font-semibold">{title}</span>
                    <ArrowRight aria-hidden className="size-4 text-ink-faint transition-transform duration-[var(--motion-control)] ease-[var(--ease-move)] group-hover:translate-x-0.5" weight="bold" />
                  </Link>
                </Panel>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
