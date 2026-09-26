"use client";

import * as React from "react";

import { useI18n } from "@/i18n";
import { useOperationPolicies } from "@/hooks/use-operation-policies";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { PolicyHistory } from "@/components/admin/policy-history";
import { SettingsGroup } from "@/components/admin/settings-group";
import { ListSection } from "@/components/ui/list";
import { ListInputRow, ListNumberRow } from "@/components/ui/list-controls";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ErrorState } from "@/components/ui/page-state";
import { SaveBar } from "@/components/ui/save-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { OPERATION_POLICIES, type OperationPolicyKey } from "@/generated/operations";

const GROUPS = [...new Set(Object.values(OPERATION_POLICIES).map((spec) => spec.group))];

export function PolicySettings() {
  const { t } = useI18n();
  const { draft, error, history, load, loading, revision } = useOperationPolicies();
  const [area, setArea] = React.useState("content");
  useUnsavedChanges(draft.changes.length, draft.reset);
  const value = draft.value;

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
        options={[
          { label: t("admin.policyContent"), value: "content" },
          { label: t("admin.policyRates"), value: "rates" },
          { label: t("admin.policyAdvanced"), value: "advanced" },
        ]}
        value={area}
      />

      {area === "advanced" ? (
        <div className="space-y-4">
          {GROUPS.filter((group) => group !== "content" && group !== "rates").map((group) => (
            <SettingsGroup key={group} title={t(`ui.operations.group.${group}`)}>
              <ListSection>
                <PolicyRows group={group} onChange={(key, next) => draft.update({ [key]: next })} value={value} />
              </ListSection>
            </SettingsGroup>
          ))}
        </div>
      ) : (
        <ListSection header={t(`ui.operations.group.${area}`)}>
          <PolicyRows group={area} onChange={(key, next) => draft.update({ [key]: next })} value={value} />
        </ListSection>
      )}

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
        onDiscard={draft.reset}
        onSave={() => void draft.submit()}
        status={draft.status}
      />
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
        value={value[key as OperationPolicyKey]}
      />
    ));
}
