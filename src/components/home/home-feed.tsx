"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Blocks, Megaphone, Wrench } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useI18n } from "@/i18n";
import { findFacilityCategory, findIssueCategory, getDefaultFacilityCategoryId, useCategories } from "@/hooks/use-categories";
import { getDefaultIssueRouteFilter, getIssueFilterOptions } from "@/constants/categories";
import { useFeedUrlState } from "@/hooks/use-feed-url-state";
import { timing } from "@/lib/motion-timing";
import AnnouncementFeed from "@/components/announcements/announcement-feed";
import FacilityFeed from "@/components/facilities/facility-feed";
import IssueFeed from "@/components/issues/issue-feed";
import { FeedNavigation } from "./feed-navigation";
import { AnnouncementNotice } from "@/components/announcements/announcement-notice";
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
  const facilityCategory = requestedFilter && findFacilityCategory(requestedFilter)
    ? requestedFilter : getDefaultFacilityCategoryId();
  const changeCategory = (category: string) => updateParams({ category, q: null, bucket: null, sort: null, status: null });
  const navigation = (
    <FeedNavigation
      label={t("ui.nav.feed")}
      onChange={(value) => {
        // Filters belong to the selected feed; never carry a facility sort into proposals.
        updateParams({ view: value === defaultView ? null : value, category: null, q: null, bucket: null, sort: null, status: null });
      }}
      options={[
        ...(categories.issuesEnabled ? [{ value: "issues", label: t("ui.nav.issues"), icon: <Blocks className="size-4" />, category: {
          value: filter,
          label: t("ui.access.selectCategory"),
          options: [...getIssueFilterOptions(), { value: "my-proposals", label: t("ui.issue.mine") }],
          onChange: changeCategory,
        } }] : []),
        { value: "announcements", label: t("ui.nav.announcements"), icon: <Megaphone className="size-4" /> },
        ...(categories.facilitiesEnabled ? [{ value: "facilities", label: t("ui.nav.facilities"), icon: <Wrench className="size-4" />, category: {
          value: facilityCategory,
          label: t("ui.access.selectCategory"),
          options: categories.activeFacilityCategories.map((category) => ({ value: category.id, label: category.label })),
          onChange: changeCategory,
        } }] : []),
      ]}
      value={view}
    />
  );

  return (
    <div className="space-y-4">
      <h1 className="sr-only">{t("ui.nav.feed")}</h1>
      <header className={`page-header ${styles.header}`}>
        <HeaderBackdrop progressive />
        <div className="flex min-w-0 items-center justify-between gap-2">
          {navigation}
          <AnnouncementNotice />
        </div>
        <div ref={setHeaderHost} />
      </header>
      <motion.div
      key={`${view}|${view === "issues" ? filter : ""}`}
      initial={reducedMotion ? false : { opacity: 0.55 }}
      animate={{ opacity: 1 }}
      transition={timing("control")}
    >
      {view === "issues" ? (
        <IssueFeed headerHost={headerHost} selectedFilter={filter} />
      ) : view === "facilities" ? (
        <FacilityFeed headerHost={headerHost} />
      ) : (
        <AnnouncementFeed headerHost={headerHost} />
      )}
      </motion.div>
    </div>
  );
}
