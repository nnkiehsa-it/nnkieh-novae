"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { Plus, Save } from "lucide-react";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { useCategoryManagement } from "@/hooks/use-category-management";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import {
  CategoryFeatureHeader,
  FacilityCategoryEditor,
  IssueCategoryEditor,
} from "@/components/admin/category-editors";

export function CategoryManagement() {
  useLocaleSubscription();
  const state = useCategoryManagement();

  if (state.loading) return <LoadingState rows={4} />;
  if (state.error)
    return <ErrorState error={state.error} onRetry={() => void state.load()} />;
  return (
    <section className="space-y-4">
      <LiquidTabs
        ariaLabel={translate('ui.admin.contentType')}
        onValueChange={state.setKind}
        options={[
          { label: translate('ui.nav.issues'), value: "issue" },
          { label: translate('ui.nav.facilities'), value: "facility" },
          { label: translate('ui.nav.announcements'), value: "announcement" },
        ]}
        value={state.kind}
      />
      {state.kind === "issue" ? (
        <Card className="gap-0 py-0">
          <CategoryFeatureHeader
            enabled={state.issuesEnabled}
            onChange={state.setIssuesEnabled}
            title={translate('ui.admin.issueFeature')}
          />
          <CardContent className="grid gap-3 py-4">
            {state.issues.map((item, index) => (
              <IssueCategoryEditor
                identifierLocked={state.persistedIssues.has(item.id)}
                index={index}
                item={item}
                key={`${item.id}-${index}`}
                onChange={(next) => state.updateIssue(index, next)}
                onDefault={() => state.setDefaultIssue(index)}
                onDelete={() => state.deleteIssue(index)}
              />
            ))}
            <Button
              disabled={!state.issuesEnabled}
              onClick={state.addIssue}
              variant="ghost"
            >
              <Plus />{translate('ui.admin.addIssueCategory')}</Button>
          </CardContent>
        </Card>
      ) : null}
      {state.kind === "facility" ? (
        <Card className="gap-0 py-0">
          <CategoryFeatureHeader
            enabled={state.facilitiesEnabled}
            onChange={state.setFacilitiesEnabled}
            title={translate('ui.admin.facilityFeature')}
          />
          <CardContent className="grid gap-3 py-4">
            {state.facilities.map((item, index) => (
              <FacilityCategoryEditor
                identifierLocked={state.persistedFacilities.has(item.id)}
                index={index}
                item={item}
                key={`${item.id}-${index}`}
                onChange={(next) => state.updateFacility(index, next)}
                onDefault={() => state.setDefaultFacility(index)}
                onDelete={() => state.deleteFacility(index)}
              />
            ))}
            <Button
              disabled={!state.facilitiesEnabled}
              onClick={state.addFacility}
              variant="ghost"
            >
              <Plus />{translate('ui.admin.addFacilityCategory')}</Button>
          </CardContent>
        </Card>
      ) : null}
      {state.kind === "announcement" ? (
        <Card className="gap-0 py-0">
          <CategoryFeatureHeader
            description={translate('ui.admin.announcementCommentsDescription')}
            enabled={state.announcementComments}
            onChange={state.setAnnouncementComments}
            title={translate('ui.admin.announcementComments')}
          />
        </Card>
      ) : null}
      <div className="flex justify-end">
        <Button disabled={!state.valid || state.saving} onClick={() => void state.save()}>
          {state.saving ? (
            <ActionFeedbackIcon
              className="bg-transparent [&>svg]:size-5"
              size="md"
              state={state.feedbackState === "success" ? "success" : "loading"}
            />
          ) : <Save />}{translate('ui.admin.saveAll')}</Button>
      </div>
    </section>
  );
}
