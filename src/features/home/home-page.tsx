import { AppLink } from "@/ui/app-link";
import { Lightbulb, Megaphone, Wrench } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useHomeStatusCounts } from "@/hooks/use-home-status-counts";
import { feedHref } from "@/lib/feed-href";
import { AnnouncementNotice } from "@/features/announcements/announcement-notice";
import { Button } from "@/ui/button";
import { Panel } from "@/ui/panel";
import { PageHeader } from "@/ui/page";
import { StatusOverview } from "./status-overview";
import { TodoCards } from "./todo-cards";

interface Destination { href: string; icon: Icon; title: string }

export function HomePage() {
  const { t } = useI18n();
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
    <div className="grid gap-6">
      <PageHeader actions={<AnnouncementNotice />} title="Novae" />
      <Panel className="p-5 md:p-7">
        <div className="grid min-w-0 gap-4">
          <div>
            <h2 className="text-balance text-xl font-semibold leading-tight tracking-tight md:text-2xl">{t("ui.home.startTitle")}</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">{t(descriptionKey)}</p>
          </div>
          <nav aria-label={t("ui.nav.feed")} className="flex flex-wrap gap-2">
            {destinations.map(({ href, icon: DestinationIcon, title }, index) => (
              <Button asChild className="max-sm:h-9 max-sm:px-3.5 max-sm:text-[0.8125rem]" key={href} variant={index === 0 ? "primary" : "secondary"}>
                <AppLink href={href}><DestinationIcon weight="bold" />{title}</AppLink>
              </Button>
            ))}
          </nav>
        </div>
      </Panel>
      {/* What is waiting and how things stand sit side by side when both are
          shown and there is room; either one alone takes the whole row. */}
      <div className="grid items-start gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
        <TodoCards counts={counts} />
        <StatusOverview counts={counts} />
      </div>
    </div>
  );
}
