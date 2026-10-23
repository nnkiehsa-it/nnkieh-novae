import * as React from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useSession } from "@/hooks/use-session";
import { completeInitialSetup } from "@/services/categories";
import type {
  FacilityCategoryDraft,
  IssueCategoryDraft,
} from "@/types/categories";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useForegroundPoll } from "@/hooks/use-foreground-poll";
import { IMAGE_UPLOAD_LIMITS } from "@shared/rate-limits.ts";
import { feedHref } from "@/lib/feed-href";

const categoryPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const newIssue = (isDefault = false): IssueCategoryDraft => ({
  authorDeleteEnabled: false,
  maxImages: IMAGE_UPLOAD_LIMITS.issueMaxImages,
  commentMaxImages: IMAGE_UPLOAD_LIMITS.commentMaxImages,
  authorVisible: true,
  commentsEnabled: true,
  id: "",
  isDefault,
  label: "",
  readAccess: "school",
  supportDeadlineDays: null,
  supportEnabled: false,
  supportGoal: null,
});
const newFacility = (isDefault = false): FacilityCategoryDraft => ({
  authorDeleteEnabled: false,
  maxImages: IMAGE_UPLOAD_LIMITS.facilityMaxImages,
  id: "",
  isDefault,
  label: "",
});

export function useInitialSetup() {
  const navigate = useNavigate();
  const session = useSession();
  const isAdmin = session.isAdmin;
  const refreshSessionAccess = session.refreshSessionAccess;
  const setupCompleted = session.setupCompleted;
  const categories = useCategories();
  const { t } = useI18n();
  const [kind, setKind] = React.useState<"issue" | "facility">("issue");
  const [issuesEnabled, setIssuesEnabled] = React.useState(true);
  const [facilitiesEnabled, setFacilitiesEnabled] = React.useState(true);
  const [issues, setIssues] = React.useState<IssueCategoryDraft[]>([newIssue(true)]);
  const [facilities, setFacilities] = React.useState<FacilityCategoryDraft[]>([
    newFacility(true),
  ]);
  const feedback = useActionFeedback();
  const [confirming, setConfirming] = React.useState(false);
  const submittingRef = React.useRef(false);

  useForegroundPoll(
    refreshSessionAccess,
    !isAdmin && !setupCompleted,
    { initialDelayMs: 3_000 },
  );

  React.useEffect(() => {
    if (setupCompleted && !submittingRef.current) void navigate("/home", { replace: true });
  }, [navigate, setupCompleted]);

  const valid = React.useMemo(() => {
    const identityValid = (values: Array<{ id: string; label: string }>) =>
      values.length > 0 &&
      new Set(values.map((value) => value.id.trim())).size === values.length &&
      values.every(
        (value) => categoryPattern.test(value.id.trim()) && value.label.trim(),
      );
    const issuesValid =
      !issuesEnabled ||
      (identityValid(issues) &&
        issues.every(
          (issue) =>
            !issue.supportEnabled ||
            (Number(issue.supportGoal) > 0 && Number(issue.supportDeadlineDays) > 0),
        ));
    return issuesValid && (!facilitiesEnabled || identityValid(facilities));
  }, [facilities, facilitiesEnabled, issues, issuesEnabled]);

  async function save() {
    if (!valid || feedback.busy) return;
    submittingRef.current = true;
    try {
      const destination = await feedback.run(async () => {
        await completeInitialSetup({
          facilitiesEnabled,
          facilityCategories: facilitiesEnabled ? facilities : [],
          issuesEnabled,
          issueCategories: issuesEnabled ? issues : [],
        });
        await refreshSessionAccess();
        await categories.refresh();
        const defaultIssueCategory =
          issues.find((category) => category.isDefault)?.id || issues[0]?.id;
        const defaultFacilityCategory =
          facilities.find((category) => category.isDefault)?.id ||
          facilities[0]?.id;
        return issuesEnabled
          ? feedHref("issues", defaultIssueCategory || "my-proposals")
          : facilitiesEnabled
            ? feedHref("facilities", defaultFacilityCategory)
            : feedHref("announcements");
      });
      setConfirming(false);
      void navigate(destination, { replace: true });
    } catch (caught) {
      const access = await refreshSessionAccess().catch(() => undefined);
      if (access?.setupCompleted) void navigate("/home", { replace: true });
      else toast.error(t(caught instanceof Error ? caught.message : "common.saveFailed"));
    } finally {
      submittingRef.current = false;
    }
  }

  return {
    addFacility: () => setFacilities((current) => [...current, newFacility()]),
    addIssue: () => setIssues((current) => [...current, newIssue()]),
    confirming,
    facilities,
    facilitiesEnabled,
    feedbackState: feedback.state,
    isAdmin,
    issues,
    issuesEnabled,
    kind,
    save,
    saving: feedback.busy,
    removeFacility: (index: number) => setFacilities((current) => current.filter((_, at) => at !== index)),
    removeIssue: (index: number) => setIssues((current) => current.filter((_, at) => at !== index)),
    setConfirming,
    setFacilitiesEnabled,
    setIssuesEnabled,
    setKind,
    updateFacility: (index: number, next: FacilityCategoryDraft) =>
      setFacilities((current) => current.map((item, at) => (at === index ? next : item))),
    updateIssue: (index: number, next: IssueCategoryDraft) =>
      setIssues((current) => current.map((item, at) => (at === index ? next : item))),
    valid,
  };
}
