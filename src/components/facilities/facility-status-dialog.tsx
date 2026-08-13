"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { LoaderCircle, Send } from "lucide-react";
import type { FacilityRecord, FacilityStatus } from "@/types";
import { useFacilityStatus } from "@/hooks/use-facility-status";
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

export function FacilityStatusDialog({
  facility,
  onOpenChange,
  onUpdated,
  open,
}: {
  facility: FacilityRecord;
  onOpenChange: (open: boolean) => void;
  onUpdated: (facility: FacilityRecord) => void;
  open: boolean;
}) {
  useLocaleSubscription();
  const state = useFacilityStatus({
    facility,
    onClose: () => onOpenChange(false),
    onUpdated,
    open,
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{translate('ui.facility.statusDialogTitle')}</DialogTitle>
          <DialogDescription>{translate('ui.facility.statusDialogDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="facility-status">{translate('ui.common.status')}</Label>
            <Select
              onValueChange={(value) => state.setStatus(value as FacilityStatus)}
              value={state.status}
            >
              <SelectTrigger id="facility-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{translate('ui.status.pending')}</SelectItem>
                <SelectItem value="processing">{translate('ui.status.processing')}</SelectItem>
                <SelectItem value="completed">{translate('ui.status.completed')}</SelectItem>
                <SelectItem value="unable-to-handle">{translate('ui.status.unable')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {state.status === "completed" || state.status === "unable-to-handle" ? (
            <div className="grid gap-2">
              <Label htmlFor="facility-result">{translate('ui.common.result')}</Label>
              <Textarea
                className="min-h-28"
                id="facility-result"
                onChange={(event) => state.setResult(event.target.value)}
                placeholder={translate('ui.facility.resultPlaceholder')}
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
