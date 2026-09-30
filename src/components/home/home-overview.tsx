"use client";

import { Blocks, Megaphone, Wrench } from "lucide-react";
import { useI18n } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import { useCategories } from "@/hooks/use-categories";
import { PageHeader } from "@/components/ui/page-state";
import { ListNavRow, ListSection } from "@/components/ui/list";
import { HomeStatistics } from "./home-statistics";
import { HomeProposals } from "./home-proposals";

export function HomeOverview() {
  const { t } = useI18n();
  const session = useSession();
  const categories = useCategories();
  return (
    <div className="space-y-5">
      <PageHeader title={t("ui.nav.home")} />
      {session.can("dashboard.view") ? <HomeStatistics canOpenActivity={session.can("role.manage")} /> : null}
      <div className="grid gap-5 lg:grid-cols-2">
        {categories.issuesEnabled ? <HomeProposals /> : null}
        <ListSection header={t("ui.home.quickLinks")}>
          {categories.issuesEnabled ? <ListNavRow href="/feed" icon={Blocks} label={t("ui.nav.issues")} /> : null}
          <ListNavRow href="/feed?view=announcements" icon={Megaphone} label={t("ui.nav.announcements")} />
          {categories.facilitiesEnabled ? <ListNavRow href="/feed?view=facilities" icon={Wrench} label={t("ui.nav.facilities")} /> : null}
        </ListSection>
      </div>
    </div>
  );
}
