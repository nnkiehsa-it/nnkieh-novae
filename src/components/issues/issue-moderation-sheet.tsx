"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import type { IssueRecord, IssueStatus } from "@/types";
import { useIssueModeration } from "@/hooks/use-issue-moderation";
import { DecisionSheet, type DecisionOption } from "@/components/ui/decision-sheet";

const REVIEW_OPTION_KEYS: ReadonlyArray<[IssueStatus, string]> = [
  ["pending", "ui.issue.approve"],
  ["review-rejected", "ui.issue.reject"],
];

const PROGRESS_OPTION_KEYS: ReadonlyArray<[IssueStatus, string]> = [
  ["processing", "ui.status.processing"],
  ["completed", "ui.status.completed"],
  ["infeasible", "ui.status.infeasible"],
];

export function IssueModerationSheet({
  issue,
  onOpenChange,
  onUpdated,
  open,
}: {
  issue: IssueRecord;
  onOpenChange: (open: boolean) => void;
  onUpdated: (issue: IssueRecord) => void;
  open: boolean;
}) {
  useLocaleSubscription();
  const state = useIssueModeration({
    issue,
    onClose: () => onOpenChange(false),
    onUpdated,
    open,
  });

  // A proposal that was turned away at review is still at review: the outcomes
  // it can take are the review outcomes, so approving it later is one tap
  // rather than a state the screen cannot express.
  const reviewing = issue.status === "under-review" || issue.status === "review-rejected";
  const options: DecisionOption[] = (
    reviewing ? REVIEW_OPTION_KEYS : PROGRESS_OPTION_KEYS
  ).map(([value, labelKey]) => ({
    label: translate(labelKey),
    tone: value === "review-rejected" ? "destructive" : "default",
    value,
  }));

  const rejecting = state.status === "review-rejected";
  const concluding = state.status === "completed" || state.status === "infeasible";

  return (
    <DecisionSheet
      busy={state.saving}
      feedback={state.feedbackState}
      note={
        rejecting
          ? {
              label: translate("ui.issue.rejectReason"),
              onChange: state.setReason,
              placeholder: translate("ui.issue.rejectPlaceholder"),
              required: true,
              value: state.reason,
            }
          : concluding
            ? {
                label: translate("ui.common.result"),
                onChange: state.setResult,
                placeholder: translate("ui.issue.resultPlaceholder"),
                required: true,
                value: state.result,
              }
            : undefined
      }
      onOpenChange={onOpenChange}
      onSubmit={() => void state.save()}
      onValueChange={(value) => state.setStatus(value as IssueStatus)}
      open={open}
      options={options}
      sectionHeader={translate("ui.common.status")}
      submitLabel={translate("ui.common.submit")}
      title={translate("ui.issue.statusDialogTitle")}
      value={state.status}
    />
  );
}
