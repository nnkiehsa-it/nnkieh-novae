"use client";

import * as React from "react";

import { useI18n } from "@/i18n";
import { useOperationPolicies } from "@/hooks/use-operation-policies";
import { useAdminView } from "@/hooks/use-admin-view";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { PolicyHistory } from "@/components/admin/policy-history";
import { ApplyReviewDialog } from "@/components/admin/apply-review-dialog";
import { SettingsGroup } from "@/components/admin/settings-group";
import { SettingPresets } from "@/components/admin/setting-presets";
import { POLICY_GROUPS, policyGroupValues, policyPresets } from "@/lib/admin-setting-presets";
import { ListSection } from "@/components/ui/list";
import { ListInputRow, ListNumberRow } from "@/components/ui/list-controls";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ErrorState } from "@/components/ui/page-state";
import { SaveBar } from "@/components/ui/save-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_OPERATION_POLICIES, OPERATION_POLICIES, type OperationPolicyKey } from "@/generated/operations";

const GROUP_LABELS = {
  content: "admin.policyContent", rates: "admin.policyRates", client: "admin.policyClient",
  jobs: "admin.policyJobs", logs: "admin.policyLogs", realtime: "admin.policyRealtime",
};

export function PolicySettings() {
  const { t } = useI18n();
  const { draft, error, history, load, loading, revision } = useOperationPolicies();
  const [area, setArea] = useAdminView(POLICY_GROUPS);
  const [reviewing, setReviewing] = React.useState(false);
  useUnsavedChanges(draft.changes.length, draft.reset);
  const value = draft.value?.values;

  if (error) return <ErrorState error={error} onRetry={() => void load()} />;
  if (loading || !value)
    return (
      <div aria-busy="true" className="space-y-6">
        {[0, 1, 2].map((index) => (
          <Skeleton className="h-56 w-full rounded-xl" key={index} />
        ))}
      </div>
    );

  return (
    <div className="space-y-6">
      <LiquidTabs
        ariaLabel={t("admin.policyArea")}
        onValueChange={setArea}
        options={POLICY_GROUPS.map((group) => ({ label: t(GROUP_LABELS[group]), value: group }))}
        value={area}
      />

      <SettingPresets current={policyGroupValues(value, area)} presets={policyPresets(area)}
        onApply={(values) => draft.update((current) => ({ ...current, values: { ...current.values, ...values } }))}
        onRestore={() => draft.update((current) => ({ ...current, values: { ...current.values, ...policyGroupValues(draft.baseline!.values, area) } }))} />
      <ListSection header={t(`ui.operations.group.${area}`)}>
          <PolicyRows group={area} onChange={(key, next) => draft.update((current) => ({ ...current, values: { ...current.values, [key]: next } }))} value={value} />
      </ListSection>

      {/* A runtime policy change is audited, so it asks for the sentence that
          will appear beside it rather than letting the record say nothing. */}
      {draft.changes.length > 0 ? (
        <ListSection header={t("admin.policyRevision", { revision })}>
          <ListInputRow
            label={t("ui.operations.reason")}
            maxLength={500}
            onChange={draft.setReason}
            placeholder={t("ui.operations.reason")}
            value={draft.reason}
          />
        </ListSection>
      ) : null}

      <SettingsGroup title={t("ui.operations.history")}>
        <PolicyHistory entries={history} showHeader={false} />
      </SettingsGroup>

      <SaveBar
        changeCount={draft.changes.length}
        disabled={!draft.valid}
        error={draft.error}
        onDiscard={draft.reset}
        onReload={() => { draft.reset(); void load(); }}
        onSave={() => void draft.submit()}
        onReview={() => setReviewing(true)}
        status={draft.status}
      />
      <ApplyReviewDialog changes={draft.changes} describeChange={(key) => t(`ui.operations.policy.${key.replace(/^values\./u, "")}`)}
        onCancel={() => setReviewing(false)} onConfirm={() => { setReviewing(false); void draft.submit(); }} open={reviewing} />
    </div>
  );
}

function PolicyRows({
  group,
  onChange,
  value,
}: {
  group: string;
  onChange: (key: OperationPolicyKey, value: number) => void;
  value: Record<OperationPolicyKey, number>;
}) {
  const { t } = useI18n();
  return Object.entries(OPERATION_POLICIES)
    .filter(([, spec]) => spec.group === group)
    .map(([key, spec]) => (
      <ListNumberRow
        key={key}
        label={t(`ui.operations.policy.${key}`)}
        max={spec.max}
        min={spec.min}
        onChange={(next) => onChange(key as OperationPolicyKey, next)}
        onReset={() => onChange(key as OperationPolicyKey, DEFAULT_OPERATION_POLICIES[key as OperationPolicyKey])}
        unit={policyUnit(key, t)}
        value={value[key as OperationPolicyKey]}
      />
    ));
}

function policyUnit(key: string, t: (key: string) => string) {
  const units = { Ms: "admin.unitMilliseconds", Seconds: "admin.unitSeconds", Minutes: "admin.unitMinutes",
    Hours: "admin.unitHours", Days: "admin.unitDays", Length: "admin.unitCharacters" };
  const unit = Object.entries(units).find(([suffix]) => key.endsWith(suffix));
  return unit ? t(unit[1]) : undefined;
}
