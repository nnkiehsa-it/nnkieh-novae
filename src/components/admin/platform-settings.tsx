"use client";

import { Save } from "lucide-react";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/page-state";
import { ResizableCard } from "@/components/ui/resizable-card";
import { RATE_LIMITS } from "@/generated/rate-limits";
import { PlatformNumberSetting } from "@/components/admin/platform-number-setting";
import { RetentionSettingsFields } from "@/components/admin/retention-settings-fields";
import { RetentionImpactDialog } from "@/components/admin/retention-impact-dialog";

export function PlatformSettings() {
  useLocaleSubscription();
  const state = usePlatformSettings();
  if (state.error) return <ErrorState error={state.error} onRetry={() => void state.load()} />;
  if (!state.settings) return null;
  const { imageUploads, retention } = state.settings;
  return (
    <section className="space-y-6">
      <RetentionSettingsFields onChange={state.updateRetention} retention={retention} />
      <ResizableCard className="gap-0 py-0">
        <CardContent className="grid gap-5 px-5 py-6 sm:px-7">
          <div>
            <h2 className="text-sm font-semibold">{translate("ui.admin.imageUploads")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{translate("ui.admin.imageUploadsDescription")}</p>
          </div>
          <div className="grid gap-4">
            <PlatformNumberSetting label={translate("ui.admin.issueImageLimit")} max={20} onChange={(value) => state.updateImage("issueMaxImages", value)} value={imageUploads.issueMaxImages} />
            <PlatformNumberSetting label={translate("ui.admin.facilityImageLimit")} max={20} onChange={(value) => state.updateImage("facilityMaxImages", value)} value={imageUploads.facilityMaxImages} />
            <PlatformNumberSetting label={translate("ui.admin.announcementImageLimit")} max={20} onChange={(value) => state.updateImage("announcementMaxImages", value)} value={imageUploads.announcementMaxImages} />
            <PlatformNumberSetting label={translate("ui.admin.commentImageLimit")} max={20} onChange={(value) => state.updateImage("commentMaxImages", value)} value={imageUploads.commentMaxImages} />
            <PlatformNumberSetting label={translate("ui.admin.imageUploadKilobytes")} max={RATE_LIMITS.imageCompression.maxPlatformUploadKilobytes} min={100} onChange={(value) => state.updateImage("maxUploadKilobytes", value)} value={imageUploads.maxUploadKilobytes} />
            <PlatformNumberSetting label={translate("ui.admin.imageMaxDimension")} max={8000} min={256} onChange={(value) => state.updateImage("maxDimension", value)} value={imageUploads.maxDimension} />
            <PlatformNumberSetting label={translate("ui.admin.imageWebpQuality")} max={0.95} min={0.4} onChange={(value) => state.updateImage("webpQuality", value)} step={0.01} value={imageUploads.webpQuality} />
          </div>
        </CardContent>
      </ResizableCard>
      <div className="flex justify-end border-t pt-5">
        <Button disabled={!state.valid || state.saving} onClick={() => void state.save()}>
          {state.saving ? <ActionFeedbackIcon className="bg-transparent [&>svg]:size-5" size="md" state={state.feedbackState === "success" ? "success" : "loading"} /> : <Save />}
          {translate("ui.admin.saveAll")}
        </Button>
      </div>
      <RetentionImpactDialog
        details={state.impactDetails}
        onCancel={state.cancelSave}
        onConfirm={() => void state.confirmSave()}
        open={state.impactOpen}
        totalEstimatedRows={state.totalEstimatedRows}
      />
    </section>
  );
}
