import { ArrowCounterClockwise } from "@phosphor-icons/react/ssr";
import { DATA_RETENTION } from "@shared/data-retention.ts";
import { useI18n } from "@/i18n";
import type { DataRetentionSettings } from "@/types/categories";
import { ListGroup, ListRow } from "@/ui/list";
import { NumberRow, SwitchRow } from "@/ui/list-controls";
import { retentionLabelKey, type RetentionItem } from "./retention-groups";

const MAX_DAYS = 3_650;
const MAX_HOURS = 87_600;

/**
 * One retention group: each lifetime as a number, with the switch that turns
 * its automatic cleanup on above it. A lifetime is only shown while cleanup is on.
 */
export function RetentionRows({ footer, items, onChange, onRestore, value }: {
  footer?: string;
  items: RetentionItem[];
  onChange: (key: keyof DataRetentionSettings, value: boolean | number) => void;
  /** Returns this group to its saved settings. */
  onRestore?: () => void;
  value: DataRetentionSettings;
}) {
  const { t } = useI18n();
  return (
    <>
      <ListGroup footer={footer}>
        {items.flatMap((item) => {
          const { enableKey } = item;
          const enabled = enableKey ? value[enableKey] === true : true;
          return [
            enableKey ? (
              <SwitchRow
                checked={enabled}
                key={enableKey}
                label={t(retentionLabelKey(enableKey))}
                onChange={(next) => onChange(enableKey, next)}
              />
            ) : null,
            enabled ? (
              <NumberRow
                key={item.key}
                label={t(retentionLabelKey(item.key))}
                max={item.unit === "hours" ? MAX_HOURS : MAX_DAYS}
                onChange={(next) => onChange(item.key, next)}
                onReset={() => onChange(item.key, DATA_RETENTION[item.key])}
                unit={t(item.unit === "hours" ? "admin.unitHours" : "admin.unitDays")}
                value={value[item.key] as number}
              />
            ) : null,
          ];
        })}
      </ListGroup>
      {onRestore ? (
        <ListGroup>
          <ListRow icon={<ArrowCounterClockwise />} label={t("admin.restoreSection")} onClick={onRestore} />
        </ListGroup>
      ) : null}
    </>
  );
}
