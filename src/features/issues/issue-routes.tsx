"use client";

import { useParams } from "next/navigation";
import { useI18n } from "@/i18n";
import { feedHref } from "@/lib/feed-href";
import { RecordRoute } from "@/features/content/record-route";
import { IssueComposer } from "./issue-composer";
import { IssueDetail } from "./issue-detail";

function useIssueListHref() {
  const { filter } = useParams<{ filter: string }>();
  return feedHref("issues", decodeURIComponent(filter));
}

export function IssueRecordRoute({ sheet = false }: { sheet?: boolean }) {
  const { t } = useI18n();
  return (
    <RecordRoute feature="issues" listHref={useIssueListHref()} sheet={sheet} title={t("ui.nav.issues")}>
      <IssueDetail />
    </RecordRoute>
  );
}

export function IssueComposerRoute({ sheet = false }: { sheet?: boolean }) {
  const { t } = useI18n();
  return (
    <RecordRoute feature="issues" listHref={useIssueListHref()} sheet={sheet} title={t("ui.issue.new")}>
      <IssueComposer />
    </RecordRoute>
  );
}
