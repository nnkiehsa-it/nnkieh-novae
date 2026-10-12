"use client";

import * as React from "react";
import { useAdminView } from "@/hooks/use-admin-view";
import { useCategoryManagement } from "@/hooks/use-category-management";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useI18n } from "@/i18n";
import { categoryManagementChanges } from "@/lib/category-review";
import { LoadingList } from "@/ui/page";
import { DraftBar } from "../shared/draft-bar";
import { LoadError } from "../shared/feedback";
import { READ_ACCESS_KEYS, isReadAccess } from "../shared/read-access";
import { SectionTabs } from "../shared/section-tabs";
import { AnnouncementPanel } from "./announcement-panel";
import { CategoryEditorSheet } from "./category-editor-sheet";
import { CategoryPanel } from "./category-panel";
import type { EditTarget } from "./category-state";

const KINDS = ["issue", "facility", "announcement"] as const;

/**
 * The categories, as a list of categories. A category is a row, and the
 * decisions inside it open in a sheet; announcements have no categories, only
 * comments and image limits. Everything is one draft with one save.
 */
export function ContentConsole() {
  const { t } = useI18n();
  const state = useCategoryManagement();
  const [kind, setKind] = useAdminView(KINDS);
  const [editing, setEditing] = React.useState<EditTarget | null>(null);
  const { baseline, reset, status } = state.draft;
  const value = state.value;
  const changes = React.useMemo(() => (baseline && value ? categoryManagementChanges(baseline, value) : []), [baseline, value]);
  useUnsavedChanges(changes.length, reset, undefined, status === "saving");
  React.useEffect(() => setEditing(null), [kind]);

  if (state.error) return <LoadError message={state.error} onRetry={() => void state.load()} />;
  if (state.loading || !value) return <LoadingList label={t("common.loading")} rows={3} />;

  const changesIn = (prefix: string, toggle?: string) =>
    changes.filter((change) => change.key.startsWith(prefix) || change.key === toggle).length;

  return (
    <div className="grid gap-6">
      <SectionTabs
        label={t("admin.contentTitle")}
        onChange={setKind}
        sections={[
          { detail: t("admin.summary.issue"), label: t("ui.nav.issues"), unsaved: changesIn("issue", "issuesEnabled") > 0, value: "issue" },
          { detail: t("admin.summary.facility"), label: t("ui.nav.facilities"), unsaved: changesIn("facility", "facilitiesEnabled") > 0, value: "facility" },
          { detail: t("admin.summary.announcement"), label: t("ui.nav.announcements"), unsaved: changesIn("announcement") > 0, value: "announcement" },
        ]}
        value={kind}
      />
      {kind === "announcement"
        ? <AnnouncementPanel state={state} value={value} />
        : <CategoryPanel kind={kind} onOpen={(index) => setEditing({ index, kind })} state={state} value={value} />}
      <CategoryEditorSheet onClose={() => setEditing(null)} state={state} target={editing} value={value} />
      <DraftBar
        changes={changes}
        describeChange={(key) => {
          const change = changes.find((item) => item.key === key);
          return [change?.categoryName, change && t(change.labelKey)].filter(Boolean).join(" · ");
        }}
        describeImpact={(key) => {
          const [jobType, scope] = key.split(":");
          return jobType === "announcement-comments" ? t("ui.admin.announcementCommentPolicy") : t("ui.admin.issueCommentPolicy", { scope });
        }}
        draft={state.draft}
        formatChangeValue={(change, field) =>
          change.key.endsWith(":readAccess") && isReadAccess(field) ? t(READ_ACCESS_KEYS[field]) : undefined}
        reload={state.load}
      />
    </div>
  );
}
