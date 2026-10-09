"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
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
import { PageHeader } from "@/components/ui/page-state";
import { ChoiceSelect } from "@/components/ui/choice-select";

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
  const categoryControl = (
    <ChoiceSelect
      ariaLabel={t("ui.access.selectCategory")}
      className="min-w-0 max-w-full flex-1 sm:max-w-56 sm:flex-none"
      onValueChange={changeCategory}
      options={view === "issues"
        ? [...getIssueFilterOptions(), { value: "my-proposals", label: t("ui.issue.mine") }]
        : categories.activeFacilityCategories.map((category) => ({ value: category.id, label: category.label }))}
      title={t("ui.access.selectCategory")}
      value={view === "issues" ? filter : facilityCategory}
    />
  );
  const navigation = (
    <FeedNavigation
      label={t("ui.nav.feed")}
      onChange={(value) => {
        // Filters belong to the selected feed; never carry a facility sort into proposals.
        updateParams({ view: value === defaultView ? null : value, category: null, q: null, bucket: null, sort: null, status: null });
      }}
      options={[
        ...(categories.issuesEnabled ? [{ value: "issues", label: t("ui.nav.issues") }] : []),
        { value: "announcements", label: t("ui.nav.announcements") },
        ...(categories.facilitiesEnabled ? [{ value: "facilities", label: t("ui.nav.facilities") }] : []),
      ]}
      value={view}
    />
  );

  return (
    <div className="space-y-4">
      <PageHeader title={t("ui.nav.feed")} subnavbar={navigation} actions={<><div ref={setHeaderHost} /><AnnouncementNotice /></>} />
      <motion.div
      key={`${view}|${view === "issues" ? filter : ""}`}
      initial={reducedMotion ? false : { opacity: 0.55 }}
      animate={{ opacity: 1 }}
      transition={timing("control")}
    >
      {view === "issues" ? (
        <IssueFeed filterControl={categoryControl} headerHost={headerHost} selectedFilter={filter} />
      ) : view === "facilities" ? (
        <FacilityFeed filterControl={categoryControl} headerHost={headerHost} />
      ) : (
        <AnnouncementFeed headerHost={headerHost} />
      )}
      </motion.div>
    </div>
  );
}
