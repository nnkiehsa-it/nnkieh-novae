import { useI18n } from "@/i18n";
import { findFacilityCategory, findIssueCategory, getDefaultFacilityCategoryId, useCategories } from "@/hooks/use-categories";
import { getDefaultIssueRouteFilter, getIssueFilterOptions } from "@/constants/categories";
import { useFeedUrlState } from "@/hooks/use-feed-url-state";
import type { FeedView } from "@/lib/feed-href";
import { AnnouncementFeed } from "@/features/announcements/announcement-feed";
import { AnnouncementNotice } from "@/features/announcements/announcement-notice";
import { FacilityFeed } from "@/features/facilities/facility-feed";
import { CategoryChips } from "@/features/feed/feed-controls";
import { IssueFeed } from "@/features/issues/issue-feed";
import { Segmented, type SegmentedOption } from "@/ui/segmented";

// A feed's own filters never carry over into another feed or category.
const CLEARED_FILTERS = { bucket: null, q: null, sort: null, status: null };

/** Proposals, facility reports and announcements behind one view switch. */
export function FeedPage() {
  const { t } = useI18n();
  const categories = useCategories();
  const { params, updateParams } = useFeedUrlState();

  const defaultView: FeedView = categories.issuesEnabled ? "issues" : "announcements";
  const requested = params.get("view");
  const view: FeedView = requested === "facilities" && categories.facilitiesEnabled ? "facilities"
    : requested === "announcements" ? "announcements" : defaultView;
  const requestedCategory = params.get("category");
  const issueFilter = requestedCategory && (requestedCategory === "my-proposals" || findIssueCategory(requestedCategory))
    ? requestedCategory : getDefaultIssueRouteFilter();
  const facilityCategory = requestedCategory && findFacilityCategory(requestedCategory)
    ? requestedCategory : getDefaultFacilityCategoryId();

  const views: SegmentedOption<FeedView>[] = [
    ...(categories.issuesEnabled ? [{ label: t("ui.nav.issues"), value: "issues" as const }] : []),
    { label: t("ui.nav.announcements"), value: "announcements" },
    ...(categories.facilitiesEnabled ? [{ label: t("ui.nav.facilities"), value: "facilities" as const }] : []),
  ];

  const categoryControl = (
    <CategoryChips
      label={t("ui.access.selectCategory")}
      onChange={(category) => updateParams({ ...CLEARED_FILTERS, category })}
      options={view === "issues"
        ? [...getIssueFilterOptions(), { label: t("ui.issue.mine"), value: "my-proposals" }]
        : categories.activeFacilityCategories.map((category) => ({ label: category.label, value: category.id }))}
      value={view === "issues" ? issueFilter : facilityCategory}
    />
  );

  // The view switch is the page's title, centred in each feed's pinned top bar.
  const viewSwitch = views.length > 1 ? (
    <Segmented
      label={t("ui.nav.feed")}
      onChange={(next) => updateParams({ ...CLEARED_FILTERS, category: null, view: next === defaultView ? null : next })}
      options={views}
      value={view}
    />
  ) : null;

  return (
    <div className="grid gap-5">
      <h1 className="sr-only">{t("ui.nav.feed")}</h1>
      {view === "issues" ? <IssueFeed categoryControl={categoryControl} filter={issueFilter} key={issueFilter} notice={<AnnouncementNotice />} viewSwitch={viewSwitch} />
        : view === "facilities" ? <FacilityFeed categoryControl={categoryControl} notice={<AnnouncementNotice />} viewSwitch={viewSwitch} />
          : <AnnouncementFeed notice={<AnnouncementNotice />} viewSwitch={viewSwitch} />}
    </div>
  );
}
