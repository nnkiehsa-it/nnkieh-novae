"use client";

import { Buildings, Lightbulb, Plus, UsersThree } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { useInitialSetup } from "@/hooks/use-initial-setup";
import { BrandLockup } from "@/features/shell/brand";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { Spinner } from "@/ui/feedback";
import { ListGroup } from "@/ui/list";
import { SwitchRow } from "@/ui/list-controls";
import { PageHeader } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { Segmented } from "@/ui/segmented";
import { FacilityDraft, IssueDraft } from "./category-drafts";

/** Shown to everyone but the administrator while the platform is set up. */
function WaitingForSetup() {
  const { t } = useI18n();
  return (
    <main className="grid min-h-svh place-items-center px-[var(--gutter)]">
      <Panel className="grid w-full max-w-md justify-items-center gap-5 px-6 py-10 text-center">
        <span aria-hidden className="grid size-14 place-items-center rounded-full bg-surface-raised [&_svg]:size-7"><UsersThree /></span>
        <div>
          <h1 className="text-xl font-semibold">{t("ui.setup.waitTitle")}</h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">{t("ui.setup.waitDescription")}</p>
        </div>
        <p className="flex items-center gap-2.5 text-sm text-ink-muted"><Spinner className="size-4" />{t("ui.setup.checking")}</p>
      </Panel>
    </main>
  );
}

export function SetupPage() {
  const { t } = useI18n();
  const setup = useInitialSetup();
  if (!setup.isAdmin) return <WaitingForSetup />;

  const issues = setup.kind === "issue";
  const enabled = issues ? setup.issuesEnabled : setup.facilitiesEnabled;
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-8 px-[var(--gutter)] pb-[max(3rem,var(--safe-bottom))] pt-[calc(var(--safe-top)+2rem)]">
      <BrandLockup />
      <PageHeader sticky={false} description={t("ui.setup.categoryDescription")} title={t("ui.setup.categoryTitle")} />
      <Segmented
        label={t("ui.setup.categoryType")}
        onChange={setup.setKind}
        options={[
          { icon: <Lightbulb />, label: t("ui.access.issueCategory"), value: "issue" },
          { icon: <Buildings />, label: t("ui.access.facilityCategory"), value: "facility" },
        ]}
        value={setup.kind}
      />
      <ListGroup footer={t("ui.setup.navHint")}>
        <SwitchRow
          checked={enabled}
          label={t(issues ? "ui.admin.issueFeature" : "ui.admin.facilityFeature")}
          onChange={issues ? setup.setIssuesEnabled : setup.setFacilitiesEnabled}
        />
      </ListGroup>
      {enabled ? (
        <div className="grid gap-6">
          {issues
            ? setup.issues.map((draft, index) => (
                <IssueDraft
                  draft={draft}
                  index={index}
                  key={index}
                  onChange={(next) => setup.updateIssue(index, next)}
                  onRemove={index === 0 ? undefined : () => setup.removeIssue(index)}
                />
              ))
            : setup.facilities.map((draft, index) => (
                <FacilityDraft
                  draft={draft}
                  index={index}
                  key={index}
                  onChange={(next) => setup.updateFacility(index, next)}
                  onRemove={index === 0 ? undefined : () => setup.removeFacility(index)}
                />
              ))}
          <Button className="justify-self-start" onClick={issues ? setup.addIssue : setup.addFacility} variant="secondary">
            <Plus weight="bold" />{t("ui.setup.addCategory")}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        confirmLabel={t("ui.setup.confirm")}
        description={t("ui.setup.finishDescription")}
        onConfirm={() => void setup.save()}
        onOpenChange={setup.setConfirming}
        open={setup.confirming}
        status={setup.feedbackState}
        title={t("ui.setup.finishTitle")}
        trigger={
          <Button className="w-full sm:justify-self-end sm:w-auto" disabled={!setup.valid} size="lg">{t("ui.setup.finish")}</Button>
        }
      />
    </main>
  );
}
