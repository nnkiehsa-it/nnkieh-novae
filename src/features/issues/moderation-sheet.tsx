import { useI18n } from "@/i18n";
import type { IssueRecord, IssueStatus } from "@/types";
import { useIssueModeration } from "@/hooks/use-issue-moderation";
import { DecisionSheet, type DecisionOption } from "@/ui/decision";

const REVIEW_OPTIONS: ReadonlyArray<readonly [IssueStatus, string]> = [
  ["pending", "ui.issue.approve"],
  ["review-rejected", "ui.issue.reject"],
];
const PROGRESS_OPTIONS: ReadonlyArray<readonly [IssueStatus, string]> = [
  ["processing", "ui.status.processing"],
  ["completed", "ui.status.completed"],
  ["infeasible", "ui.status.infeasible"],
];

/** Moves a proposal through review, then through to its outcome. */
export function ModerationSheet({ issue, onOpenChange, onUpdated, open }: {
  issue: IssueRecord;
  onOpenChange: (open: boolean) => void;
  onUpdated: (issue: IssueRecord) => void;
  open: boolean;
}) {
  const { t } = useI18n();
  const state = useIssueModeration({ issue, onClose: () => onOpenChange(false), onUpdated, open });
  // A proposal turned away at review is still at review: approving it later is
  // one of its outcomes, not a state the sheet cannot express.
  const reviewing = issue.status === "under-review" || issue.status === "review-rejected";
  const options: DecisionOption[] = (reviewing ? REVIEW_OPTIONS : PROGRESS_OPTIONS).map(([value, labelKey]) => ({
    label: t(labelKey),
    tone: value === "review-rejected" ? "danger" : "default",
    value,
  }));
  const rejecting = state.status === "review-rejected";
  const concluding = state.status === "completed" || state.status === "infeasible";

  return (
    <DecisionSheet
      note={rejecting
        ? { label: t("ui.issue.rejectReason"), onChange: state.setReason, placeholder: t("ui.issue.rejectPlaceholder"), required: true, value: state.reason }
        : concluding
          ? { label: t("ui.common.result"), onChange: state.setResult, placeholder: t("ui.issue.resultPlaceholder"), required: true, value: state.result }
          : undefined}
      onOpenChange={onOpenChange}
      onSubmit={() => void state.save()}
      onValueChange={(value) => state.setStatus(value as IssueStatus)}
      open={open}
      options={options}
      sheetTitle={t("ui.issue.statusDialogTitle")}
      status={state.saving ? (state.feedbackState === "success" ? "success" : "loading") : "idle"}
      submitLabel={t("ui.common.submit")}
      title={t("ui.common.status")}
      value={state.status}
    />
  );
}
