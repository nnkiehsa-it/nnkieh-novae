"use client";
import { t as translate } from "@/i18n";

import { Building2, Sparkles } from "lucide-react";
import { useInitialSetup } from "@/hooks/use-initial-setup";
import { Button } from "@/components/ui/button";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { BusyLabel, PageHeader } from "@/components/ui/page-state";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CategorySetupPanel,
  FacilityDraftEditor,
  IssueDraftEditor,
} from "@/components/setup/category-setup-fields";
import {
  SetupBrand,
  SetupLanguageStep,
  SetupWaitingState,
} from "@/components/setup/setup-steps";

export default function SetupPage() {
  const state = useInitialSetup();

  if (!state.isAdmin) {
    return <SetupWaitingState />;
  }

  return (
    <main className="min-h-[100svh] bg-[var(--surface-stage)] px-[max(1rem,var(--safe-left))] py-[max(2rem,var(--safe-top))]">
      <div className="mx-auto max-w-4xl">
        <SetupBrand />
        {state.step === "language" ? (
          <SetupLanguageStep
            locale={state.locale}
            onContinue={() => state.setStep("categories")}
          />
        ) : (
          <section className="t-route-enter" data-route-direction="root">
            <PageHeader
              title={translate('ui.setup.categoryTitle')}
            />
            <div className="mt-6">
              <LiquidTabs
                ariaLabel={translate('ui.setup.categoryType')}
                onValueChange={state.setKind}
                options={[
                  {
                    icon: <Sparkles className="size-3.5" />,
                    label: translate('ui.access.issueCategory'),
                    value: "issue",
                  },
                  {
                    icon: <Building2 className="size-3.5" />,
                    label: translate('ui.access.facilityCategory'),
                    value: "facility",
                  },
                ]}
                value={state.kind}
              />
            </div>
            <div className="mt-4">
              {state.kind === "issue" ? (
                <CategorySetupPanel
                  enabled={state.issuesEnabled}
                  onEnabledChange={state.setIssuesEnabled}
                  onAdd={state.addIssue}
                  title={translate('ui.admin.issueFeature')}
                >
                  {state.issues.map((issue, index) => (
                    <IssueDraftEditor
                      draft={issue}
                      index={index}
                      key={index}
                      onChange={(next) =>
                        state.setIssues((current) =>
                          current.map((item, currentIndex) =>
                            currentIndex === index ? next : item,
                          ),
                        )
                      }
                      onRemove={
                        index === 0
                          ? undefined
                          : () =>
                              state.setIssues((current) =>
                                current.filter(
                                  (_, currentIndex) => currentIndex !== index,
                                ),
                              )
                      }
                    />
                  ))}
                </CategorySetupPanel>
              ) : (
                <CategorySetupPanel
                  enabled={state.facilitiesEnabled}
                  onEnabledChange={state.setFacilitiesEnabled}
                  onAdd={state.addFacility}
                  title={translate('ui.admin.facilityFeature')}
                >
                  {state.facilities.map((facility, index) => (
                    <FacilityDraftEditor
                      draft={facility}
                      index={index}
                      key={index}
                      onChange={(next) =>
                        state.setFacilities((current) =>
                          current.map((item, currentIndex) =>
                            currentIndex === index ? next : item,
                          ),
                        )
                      }
                      onRemove={
                        index === 0
                          ? undefined
                          : () =>
                              state.setFacilities((current) =>
                                current.filter(
                                  (_, currentIndex) => currentIndex !== index,
                                ),
                              )
                      }
                    />
                  ))}
                </CategorySetupPanel>
              )}
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <Button onClick={() => state.setStep("language")} variant="ghost">{translate('ui.common.back')}</Button>
              <Button
                disabled={!state.valid || state.saving}
                onClick={() => state.setConfirming(true)}
              >
                <BusyLabel
                  busy={state.saving}
                  busyLabel={translate('ui.setup.finishing')}
                  label={translate('ui.setup.finish')}
                />
              </Button>
            </div>
          </section>
        )}
      </div>
      <Dialog open={state.confirming} onOpenChange={state.setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{translate('ui.setup.finishTitle')}</DialogTitle>
            <DialogDescription>{translate('ui.setup.finishDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => state.setConfirming(false)} variant="outline">{translate('ui.common.cancel')}</Button>
            <Button disabled={state.saving} onClick={() => void state.save()}>
              {state.saving ? (
                <ActionFeedbackIcon
                  className="bg-transparent [&>svg]:size-5"
                  size="md"
                  state={state.feedbackState === "success" ? "success" : "loading"}
                />
              ) : null}
              {translate('ui.setup.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
