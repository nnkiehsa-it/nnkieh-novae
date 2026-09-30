"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Blocks, Megaphone, Wrench } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useI18n } from "@/i18n";
import { findIssueCategory, useCategories } from "@/hooks/use-categories";
import { getDefaultIssueRouteFilter } from "@/constants/categories";
import { useFeedUrlState } from "@/hooks/use-feed-url-state";
import AnnouncementFeed from "@/components/announcements/announcement-feed";
import FacilityFeed from "@/components/facilities/facility-feed";
import IssueFeed from "@/components/issues/issue-feed";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { HeaderBackdrop } from "@/components/ui/header-backdrop";
import styles from "./home-feed.module.css";

export function HomeFeed() {
  const { t } = useI18n();
  const categories = useCategories();
  const params = useSearchParams();
  const { updateParams } = useFeedUrlState();
  const reducedMotion = useReducedMotion();
  const [headerHost, setHeaderHost] = useState<HTMLDivElement | null>(null);
  const requested = params.get("view");
  const defaultView = categories.issuesEnabled ? "issues" : "announcements";
  const view = requested === "facilities" && categories.facilitiesEnabled ? "facilities"
    : requested === "announcements" ? "announcements" : defaultView;
  const requestedFilter = params.get("category");
  const filter = requestedFilter && (requestedFilter === "my-proposals" || findIssueCategory(requestedFilter))
    ? requestedFilter : getDefaultIssueRouteFilter();
  const navigation = (
    <LiquidTabs
      ariaLabel={t("ui.nav.feed")}
      className={styles.tabs}
      onValueChange={(value) => {
        // Filters belong to the selected feed; never carry a facility sort into proposals.
        updateParams({ view: value === defaultView ? null : value, category: null, q: null, bucket: null, sort: null, status: null });
      }}
      options={[
        ...(categories.issuesEnabled ? [{ value: "issues", label: t("ui.nav.issues"), icon: <Blocks className="size-4" /> }] : []),
        { value: "announcements", label: t("ui.nav.announcements"), icon: <Megaphone className="size-4" /> },
        ...(categories.facilitiesEnabled ? [{ value: "facilities", label: t("ui.nav.facilities"), icon: <Wrench className="size-4" /> }] : []),
      ]}
      value={view}
    />
  );

  return (
    <div className="space-y-4">
      <header className={`page-header ${styles.header}`}>
        <HeaderBackdrop progressive />
        {navigation}
        <div ref={setHeaderHost} />
      </header>
      <motion.div
      key={`${view}|${view === "issues" ? filter : ""}`}
      initial={reducedMotion ? false : { opacity: 0.55 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {view === "issues" ? (
        <IssueFeed headerHost={headerHost} selectedFilter={filter} onFilterChange={(category) => updateParams({ category, q: null, bucket: null, sort: null })} />
      ) : view === "facilities" ? (
        <FacilityFeed headerHost={headerHost} />
      ) : (
        <AnnouncementFeed headerHost={headerHost} />
      )}
      </motion.div>
    </div>
  );
}
