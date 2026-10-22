import { useI18n } from "@/i18n";
import { DEFAULT_OPERATION_POLICIES, OPERATION_POLICIES, type OperationPolicies, type OperationPolicyKey } from "@shared/operation-policies.ts";
import { NumberRow } from "@/ui/list-controls";
import type { Translate } from "../shared/translate";

const UNIT_KEYS = {
  Ms: "admin.unitMilliseconds",
  Seconds: "admin.unitSeconds",
  Minutes: "admin.unitMinutes",
  Hours: "admin.unitHours",
  Days: "admin.unitDays",
  Length: "admin.unitCharacters",
} as const;

/** The unit a policy is counted in, which its name ends with. */
function unitOf(key: string, t: Translate) {
  const suffix = (Object.keys(UNIT_KEYS) as Array<keyof typeof UNIT_KEYS>).find((candidate) => key.endsWith(candidate));
  return suffix ? t(UNIT_KEYS[suffix]) : undefined;
}

/** Every policy of one group as a number to set, each able to return to its default. */
export function PolicyRows({ group, onChange, value }: {
  group: string;
  onChange: (key: OperationPolicyKey, value: number) => void;
  value: OperationPolicies;
}) {
  const { t } = useI18n();
  const keys = (Object.keys(OPERATION_POLICIES) as OperationPolicyKey[]).filter((key) => OPERATION_POLICIES[key].group === group);
  return keys.map((key) => (
    <NumberRow
      key={key}
      label={t(`ui.operations.policy.${key}`)}
      max={OPERATION_POLICIES[key].max}
      min={OPERATION_POLICIES[key].min}
      onChange={(next) => onChange(key, next)}
      onReset={() => onChange(key, DEFAULT_OPERATION_POLICIES[key])}
      unit={unitOf(key, t)}
      value={value[key]}
    />
  ));
}
