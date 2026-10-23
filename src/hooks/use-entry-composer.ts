import * as React from "react";
import { useI18n } from "@/i18n";
import { useAppLocation, useAppNavigate } from "@/hooks/use-app-location";
import { matchAppRoute } from "@/lib/route-hierarchy";
import {
  findIssueCategory,
  useCategories,
} from "@/hooks/use-categories";
import { useComposerBase } from "@/hooks/use-composer-base";
import { useSession } from "@/hooks/use-session";
import { createAnnouncement } from "@/services/announcements";
import { createFacility } from "@/services/facilities";
import { createIssue } from "@/services/issues";

export function useAnnouncementComposer() {
  const navigate = useAppNavigate();
  const session = useSession();
  const { t } = useI18n();
  const form = useComposerBase("announcement");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !form.title.trim() ||
      !form.content.trim() ||
      !form.contentWithinLimit ||
      form.saving || form.images.uploading
    ) return;
    await form.withUploads(async (content) => {
      const announcement = await createAnnouncement({
        content,
        title: form.title.trim(),
      });
      return `/announcements/${announcement.id}`;
    }, (href) => navigate(href, { replace: true }), t("ui.announcement.publishFailed"));
  }
  return {
    ...form,
    canManage: session.can("announcement.manage"),
    submit,
  };
}

export function useIssueComposer() {
  const route = matchAppRoute(useAppLocation().pathname);
  const navigate = useAppNavigate();
  const { t } = useI18n();
  const category = route.kind === "issue-composer" ? route.filter : "";
  const form = useComposerBase("issue", `issue:${category}`, category);
  const config = findIssueCategory(category);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !config ||
      !form.title.trim() ||
      !form.content.trim() ||
      !form.contentWithinLimit ||
      form.saving || form.images.uploading
    ) return;
    await form.withUploads(async (content) => {
      const issue = await createIssue({ category, content, title: form.title.trim() });
      return `/issues/${encodeURIComponent(category)}/${issue.id}`;
    }, (href) => navigate(href, { replace: true }), t("ui.issue.submitFailed"));
  }
  return { ...form, category, config, submit };
}

export function useFacilityComposer() {
  const navigate = useAppNavigate();
  const { search } = useAppLocation();
  const categories = useCategories();
  const { t } = useI18n();
  const form = useComposerBase("facility", "facility", search.get("category") ?? "");
  const category = form.categoryId;
  const location = form.draft.value.location;
  const setCategory = (value: string) => form.draft.update({ category: value });
  const setLocation = (value: string) => form.draft.update({ location: value, category });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !category ||
      !form.title.trim() ||
      !location.trim() ||
      !form.content.trim() ||
      !form.contentWithinLimit ||
      form.saving || form.images.uploading
    )
      return;
    await form.withUploads(async (content) => {
      const facility = await createFacility({
        categoryId: category,
        content,
        location: location.trim(),
        title: form.title.trim(),
      });
      return `/facilities/${facility.id}?category=${encodeURIComponent(category)}`;
    }, (href) => navigate(href, { replace: true }), t("ui.facility.submitFailed"));
  }
  return {
    ...form,
    categories: categories.activeFacilityCategories,
    category,
    location,
    setCategory,
    setLocation,
    setTitle: (value: string) => form.draft.update({ title: value, category }),
    setContent: (value: string) => form.draft.update({ content: value, category }),
    submit,
  };
}
