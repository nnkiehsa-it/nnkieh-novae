"use client";

import { Save } from "lucide-react";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/page-state";
import { ResizableCard } from "@/components/ui/resizable-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RATE_LIMITS } from "@/generated/rate-limits";

interface NumberSettingProps {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}

function NumberSetting({ label, max, min = 1, onChange, step = 1, value }: NumberSettingProps) {
  return (
    <label className="grid gap-2 text-sm font-medium sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
      <span>{label}</span>
      <Input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="number"
        value={Number.isFinite(value) ? value : ""}
      />
    </label>
  );
}

export function PlatformSettings() {
  useLocaleSubscription();
  const state = usePlatformSettings();
  if (state.error) return <ErrorState error={state.error} onRetry={() => void state.load()} />;
  if (!state.settings) return null;
  const { imageUploads, retention } = state.settings;
  return (
    <section className="space-y-6">
      <ResizableCard className="gap-0 py-0">
        <CardContent className="grid gap-5 px-5 py-6 sm:px-7">
          <div>
            <h2 className="text-sm font-semibold">{translate("ui.admin.closedContentRetention")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{translate("ui.admin.closedContentRetentionDescription")}</p>
          </div>
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="closed-issues-enabled">{translate("ui.admin.closedIssuesDeletion")}</Label>
              <Switch checked={retention.closedIssuesEnabled} id="closed-issues-enabled" onCheckedChange={(value) => state.updateRetention("closedIssuesEnabled", value)} />
            </div>
            {retention.closedIssuesEnabled ? <NumberSetting label={translate("ui.admin.closedIssuesDays")} max={3650} onChange={(value) => state.updateRetention("closedIssuesDays", value)} value={retention.closedIssuesDays} /> : null}
            <div className="flex items-center justify-between gap-4 border-t pt-4">
              <Label htmlFor="closed-facilities-enabled">{translate("ui.admin.closedFacilitiesDeletion")}</Label>
              <Switch checked={retention.closedFacilitiesEnabled} id="closed-facilities-enabled" onCheckedChange={(value) => state.updateRetention("closedFacilitiesEnabled", value)} />
            </div>
            {retention.closedFacilitiesEnabled ? <NumberSetting label={translate("ui.admin.closedFacilitiesDays")} max={3650} onChange={(value) => state.updateRetention("closedFacilitiesDays", value)} value={retention.closedFacilitiesDays} /> : null}
          </div>
        </CardContent>
      </ResizableCard>
      <ResizableCard className="gap-0 py-0">
        <CardContent className="grid gap-5 px-5 py-6 sm:px-7">
          <div>
            <h2 className="text-sm font-semibold">{translate("ui.admin.imageUploads")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{translate("ui.admin.imageUploadsDescription")}</p>
          </div>
          <div className="grid gap-4">
            <NumberSetting label={translate("ui.admin.issueImageLimit")} max={20} onChange={(value) => state.updateImage("issueMaxImages", value)} value={imageUploads.issueMaxImages} />
            <NumberSetting label={translate("ui.admin.facilityImageLimit")} max={20} onChange={(value) => state.updateImage("facilityMaxImages", value)} value={imageUploads.facilityMaxImages} />
            <NumberSetting label={translate("ui.admin.announcementImageLimit")} max={20} onChange={(value) => state.updateImage("announcementMaxImages", value)} value={imageUploads.announcementMaxImages} />
            <NumberSetting label={translate("ui.admin.commentImageLimit")} max={20} onChange={(value) => state.updateImage("commentMaxImages", value)} value={imageUploads.commentMaxImages} />
            <NumberSetting label={translate("ui.admin.imageUploadKilobytes")} max={RATE_LIMITS.imageCompression.maxPlatformUploadKilobytes} min={100} onChange={(value) => state.updateImage("maxUploadKilobytes", value)} value={imageUploads.maxUploadKilobytes} />
            <NumberSetting label={translate("ui.admin.imageSourceMegabytes")} max={50} onChange={(value) => state.updateImage("maxSourceMegabytes", value)} value={imageUploads.maxSourceMegabytes} />
            <NumberSetting label={translate("ui.admin.imageMaxDimension")} max={8000} min={256} onChange={(value) => state.updateImage("maxDimension", value)} value={imageUploads.maxDimension} />
            <NumberSetting label={translate("ui.admin.imageWebpQuality")} max={0.95} min={0.4} onChange={(value) => state.updateImage("webpQuality", value)} step={0.01} value={imageUploads.webpQuality} />
          </div>
        </CardContent>
      </ResizableCard>
      <div className="flex justify-end border-t pt-5">
        <Button disabled={!state.valid || state.saving} onClick={() => void state.save()}>
          {state.saving ? <ActionFeedbackIcon className="bg-transparent [&>svg]:size-5" size="md" state={state.feedbackState === "success" ? "success" : "loading"} /> : <Save />}
          {translate("ui.admin.saveAll")}
        </Button>
      </div>
    </section>
  );
}
