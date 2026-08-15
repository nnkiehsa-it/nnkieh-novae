"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { ArrowLeft, ArrowUp, MapPin } from "lucide-react";
import { useFacilityComposer } from "@/hooks/use-entry-composer";
import { ComposerField } from "@/components/composer-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BusyLabel, PageHeader } from "@/components/ui/page-state";

import { INPUT_LIMITS } from "@/constants/input-limits";
import { cn } from "@/lib/utils";

export default function FacilityComposerPage() {
  useLocaleSubscription();
  const form = useFacilityComposer();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        actions={
          <Button onClick={form.back} variant="ghost">
            <ArrowLeft />{translate('ui.common.back')}</Button>
        }
        title={translate('ui.facility.newTitle')}
      />
      <form onSubmit={form.submit}>
        <Card className="py-6">
          <CardContent className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{translate('ui.access.facilityCategory')}</Label>
                <Select onValueChange={form.setCategory} value={form.category}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {form.categories.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="facility-location">{translate('ui.facility.location')}</Label>
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      form.location.length > INPUT_LIMITS.facilityLocation
                        ? "font-medium text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {form.location.length} / {INPUT_LIMITS.facilityLocation}
                  </span>
                </div>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    id="facility-location"
                    maxLength={INPUT_LIMITS.facilityLocation}
                    onChange={(event) => form.setLocation(event.target.value)}
                    placeholder={translate('ui.facility.locationExample')}
                    value={form.location}
                  />
                </div>
              </div>
            </div>
            <ComposerField
              attachments={form.images.images}
              content={form.content}
              contentLabel={translate('ui.facility.problemDescription')}
              onContentChange={form.setContent}
              onPickImages={(files) => void form.images.pick(files)}
              onRemoveImage={form.images.remove}
              onTitleChange={form.setTitle}
              placeholder={translate('ui.facility.problemPlaceholder')}
              title={form.title}
              titleLabel={translate('ui.facility.reportTitle')}
              titlePlaceholder={translate('ui.facility.reportTitlePlaceholder')}
            />
            <div className="flex justify-end">
              <Button
                disabled={
                  !form.category ||
                  !form.title.trim() ||
                  !form.location.trim() ||
                  !form.content.trim() ||
                  form.saving ||
                  form.images.uploading
                }
                type="submit"
              >
                {form.saving || form.images.uploading ? null : <ArrowUp />}
                <BusyLabel
                  busy={form.saving || form.images.uploading}
                  busyLabel={translate('ui.issue.submitting')}
                  label={translate('ui.facility.submit')}
                  success={form.succeeded}
                />
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
