"use client";

import { useI18n } from "@/i18n";
import { useOperationPolicies } from "@/hooks/use-operation-policies";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { PolicyHistory } from "@/components/admin/policy-history";
import { ListSection } from "@/components/ui/list";
import { ListInputRow, ListNumberRow } from "@/components/ui/list-controls";
import { ErrorState } from "@/components/ui/page-state";
import { SaveBar } from "@/components/ui/save-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { OPERATION_POLICIES, type OperationPolicyKey } from "@/generated/operations";

const GROUPS = [...new Set(Object.values(OPERATION_POLICIES).map((spec) => spec.group))];

export function PolicySettings() {
  const { t } = useI18n();
  const { draft, error, history, load, loading, revision } = useOperationPolicies();
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
      {GROUPS.map((group) => (
        <ListSection header={t(`ui.operations.group.${group}`)} key={group}>
          {Object.entries(OPERATION_POLICIES)
            .filter(([, spec]) => spec.group === group)
            .map(([key, spec]) => (
              <ListNumberRow
                key={key}
                label={t(`ui.operations.policy.${key}`)}
                max={spec.max}
                min={spec.min}
                onChange={(next) => draft.update({ [key]: next } as Partial<typeof value>)}
                value={value[key as OperationPolicyKey]}
              />
            ))}
        </ListSection>
      ))}

      {/* A runtime policy change is audited, so it asks for the sentence that
          will appear beside it rather than letting the record say nothing. */}
      <ListSection
        footer={t("ui.operations.policyHelp")}
        header={t("admin.policyRevision", { revision })}
      >
        <ListInputRow
          label={t("ui.operations.reason")}
          maxLength={500}
          onChange={draft.setReason}
          placeholder={t("ui.operations.reason")}
          value={draft.reason}
        />
      </ListSection>

      <PolicyHistory entries={history} />

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
