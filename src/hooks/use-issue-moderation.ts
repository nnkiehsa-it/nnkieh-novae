"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { moderateIssueStatus, updateIssueResult } from "@/services/issues";
import type { IssueRecord, IssueStatus } from "@/types";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export function useIssueModeration({
  issue,
  onClose,
  onUpdated,
  open,
}: {
  issue: IssueRecord;
  onClose: () => void;
  onUpdated: (issue: IssueRecord) => void;
  open: boolean;
}) {
  const { t } = useI18n();
  const [status, setStatus] = React.useState<IssueStatus>(issue.status);
  const [result, setResult] = React.useState(issue.result_content ?? "");
  const [reason, setReason] = React.useState(issue.review_rejection_reason ?? "");
  const feedback = useActionFeedback();

  React.useEffect(() => {
    if (!open) return;
    setStatus(
      issue.status === "under-review"
        ? "pending"
        : issue.status === "pending"
          ? "processing"
          : issue.status,
    );
    setResult(issue.result_content ?? "");
    setReason(issue.review_rejection_reason ?? "");
  }, [issue, open]);

  async function save() {
    if (
      (status === "review-rejected" && !reason.trim()) ||
      ((status === "completed" || status === "infeasible") && !result.trim())
    )
      return;
    try {
      const updated = await feedback.run(async () => {
        let next = await moderateIssueStatus(
          issue.id,
          status,
          status === "review-rejected" ? reason.trim() : undefined,
        );
        if (status === "completed" || status === "infeasible")
          next = await updateIssueResult(issue.id, result.trim());
        else if (status === "processing" && issue.result_content)
          next = await updateIssueResult(issue.id, "");
        return next;
      });
      onUpdated(updated);
      onClose();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.updateFailed"));
    }
  }

  return {
    feedbackState: feedback.state,
    reason,
    result,
    save,
    saving: feedback.busy,
    setReason,
    setResult,
    setStatus,
    status,
  };
}
