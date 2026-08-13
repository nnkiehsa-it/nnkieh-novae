"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { LoaderCircle, Send } from "lucide-react";
import type { IssueRecord, IssueStatus } from "@/types";
import { useIssueModeration } from "@/hooks/use-issue-moderation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function IssueModerationDialog({
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

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{translate('ui.issue.statusDialogTitle')}</DialogTitle>
          <DialogDescription>{translate('ui.issue.statusDialogDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="issue-status">{translate('ui.common.status')}</Label>
            <Select
              onValueChange={(value) => state.setStatus(value as IssueStatus)}
              value={state.status}
            >
              <SelectTrigger id="issue-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {issue.status === "under-review" ? (
                  <>
                    <SelectItem value="pending">{translate('ui.issue.approve')}</SelectItem>
                    <SelectItem value="review-rejected">{translate('ui.issue.reject')}</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="processing">{translate('ui.status.processing')}</SelectItem>
                    <SelectItem value="completed">{translate('ui.status.completed')}</SelectItem>
                    <SelectItem value="infeasible">{translate('ui.status.infeasible')}</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          {state.status === "review-rejected" ? (
            <div className="grid gap-2">
              <Label htmlFor="issue-rejection-reason">{translate('ui.issue.rejectReason')}</Label>
              <Textarea
                id="issue-rejection-reason"
                onChange={(event) => state.setReason(event.target.value)}
                placeholder={translate('ui.issue.rejectPlaceholder')}
                value={state.reason}
              />
            </div>
          ) : null}
          {state.status === "completed" || state.status === "infeasible" ? (
            <div className="grid gap-2">
              <Label htmlFor="issue-result">{translate('ui.common.result')}</Label>
              <Textarea
                className="min-h-28"
                id="issue-result"
                onChange={(event) => state.setResult(event.target.value)}
                placeholder={translate('ui.issue.resultPlaceholder')}
                value={state.result}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">{translate('ui.common.cancel')}</Button>
          <Button disabled={state.saving} onClick={() => void state.save()}>
            {state.saving ? <LoaderCircle className="t-spinner" /> : <Send />}{translate('ui.common.saveChanges')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
