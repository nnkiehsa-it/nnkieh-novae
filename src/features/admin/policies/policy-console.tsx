import { OPERATION_POLICIES, type OperationPolicyKey } from "@shared/operation-policies.ts";
import { useAdminView } from "@/hooks/use-admin-view";
import { useOperationPolicies } from "@/hooks/use-operation-policies";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useI18n } from "@/i18n";
import { POLICY_GROUPS, policyGroupValues, policyPresets } from "@/lib/admin-setting-presets";
import { ListGroup } from "@/ui/list";
import { InputRow } from "@/ui/list-controls";
import { LoadingList } from "@/ui/page";
import { Disclosure } from "../shared/disclosure";
import { DraftBar } from "../shared/draft-bar";
import { LoadError } from "../shared/feedback";
import { SectionTabs } from "../shared/section-tabs";
import { SettingPresets } from "../shared/setting-presets";
import { PolicyHistory } from "./policy-history";
import { PolicyRows } from "./policy-rows";

const GROUP_LABELS = {
  client: "admin.policyClient",
  content: "admin.policyContent",
  jobs: "admin.policyJobs",
  logs: "admin.policyLogs",
  rates: "admin.policyRates",
  realtime: "admin.policyRealtime",
} as const;

const GROUP_DETAILS = {
  client: "admin.summary.policyClient",
  content: "admin.summary.policyContent",
  jobs: "admin.summary.policyJobs",
  logs: "admin.summary.policyLogs",
  rates: "admin.summary.policyRates",
  realtime: "admin.summary.policyRealtime",
} as const;

const policyKeyOf = (changeKey: string) => changeKey.replace(/^values\./u, "") as OperationPolicyKey;

/**
 * Runtime limits, one group at a time. A change is audited, so saving asks for
 * the sentence that will sit beside it in the history.
 */
export function PolicyConsole() {
  const { t } = useI18n();
  const { draft, error, history, load, loading, revision } = useOperationPolicies();
  const [group, setGroup] = useAdminView(POLICY_GROUPS);
  useUnsavedChanges(draft.changes.length, draft.reset, undefined, draft.status === "saving");
  const values = draft.value?.values;
  const baseline = draft.baseline?.values;

  if (error) return <LoadError message={error} onRetry={() => void load()} />;
  if (loading || !values) return <LoadingList label={t("common.loading")} rows={3} />;

  const setValues = (patch: Partial<typeof values>) =>
    draft.update((current) => ({ ...current, values: { ...current.values, ...patch } }));

  return (
    <div className="grid gap-6">
      <SectionTabs
        label={t("admin.policiesTitle")}
        onChange={setGroup}
        sections={POLICY_GROUPS.map((candidate) => ({
          detail: t(GROUP_DETAILS[candidate]),
          label: t(GROUP_LABELS[candidate]),
          unsaved: draft.changes.some((change) => OPERATION_POLICIES[policyKeyOf(change.key)].group === candidate),
          value: candidate,
        }))}
        value={group}
      />
      <SettingPresets
        current={policyGroupValues(values, group)}
        onApply={setValues}
        onRestore={baseline ? () => setValues(policyGroupValues(baseline, group)) : undefined}
        presets={policyPresets(group)}
      />
      <ListGroup title={t(`ui.operations.group.${group}`)}>
        <PolicyRows group={group} onChange={(key, next) => setValues({ [key]: next })} value={values} />
      </ListGroup>
      {draft.changes.length > 0 ? (
        <ListGroup title={t("admin.policyRevision", { revision })}>
          <InputRow
            label={t("ui.operations.reason")}
            maxLength={500}
            onChange={draft.setReason}
            placeholder={t("ui.operations.reason")}
            value={draft.reason}
          />
        </ListGroup>
      ) : null}
      <Disclosure title={t("ui.operations.history")}>
        <PolicyHistory entries={history} />
      </Disclosure>
      <DraftBar
        changes={draft.changes}
        describeChange={(key) => t(`ui.operations.policy.${policyKeyOf(key)}`)}
        draft={draft}
        reload={load}
      />
    </div>
  );
}
