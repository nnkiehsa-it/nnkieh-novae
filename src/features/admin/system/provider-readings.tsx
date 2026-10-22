import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import {
  formatBytes,
  formatCount,
  formatMilliseconds,
  percentOf,
  readCloudinaryUsage,
  readWorkerLogs,
  readWorkerMetrics,
} from "@/lib/provider-diagnostics-format";
import { ProgressBar } from "@/ui/feedback";
import { ListRow } from "@/ui/list";

/** A counter that has a ceiling, drawn against it. */
function Meter({ label, percent, value }: { label: string; percent: number | null; value: string }) {
  return (
    <li className="grid gap-2 px-5 py-3">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-base">{label}</span>
        <span className="text-base tabular-nums">{value}</span>
      </span>
      {percent === null ? null : <ProgressBar label={label} value={Math.max(percent, 1.5) / 100} />}
    </li>
  );
}

/** The headline figures of a reading, on one band rather than in four rows. */
function FigureBand({ figures }: { figures: ReadonlyArray<readonly [string, string]> }) {
  return (
    <li className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-3 sm:grid-cols-4">
      {figures.map(([label, value]) => (
        <span className="block min-w-0" key={label}>
          <span className="block truncate text-sm text-ink-muted">{label}</span>
          <span className="mt-0.5 block text-xl font-semibold tabular-nums tracking-tight">{value}</span>
        </span>
      ))}
    </li>
  );
}

export function CloudinaryReport({ data }: { data: unknown }) {
  const { t } = useI18n();
  const reading = readCloudinaryUsage(data);
  if (!reading) return null;
  const { credits } = reading;
  const counted: ReadonlyArray<readonly [string, string | null]> = [
    [t("ui.operations.providerPlan"), reading.plan],
    [t("ui.operations.providerStorage"), reading.storageBytes === null ? null : formatBytes(reading.storageBytes)],
    [t("ui.operations.providerBandwidth"), reading.bandwidthBytes === null ? null : formatBytes(reading.bandwidthBytes)],
    [t("ui.operations.providerTransformations"), reading.transformations === null ? null : formatCount(reading.transformations)],
    [t("ui.operations.providerObjects"), reading.objects === null ? null : formatCount(reading.objects)],
    [t("ui.operations.providerRequests"), reading.requests === null ? null : formatCount(reading.requests)],
    [t("ui.operations.providerUpdated"), reading.lastUpdated],
  ];

  return (
    <>
      {credits ? (
        <Meter
          label={t("ui.operations.providerCredits")}
          percent={percentOf(credits.usage, credits.limit)}
          value={credits.limit ? `${credits.usage.toFixed(2)} / ${formatCount(credits.limit)}` : credits.usage.toFixed(2)}
        />
      ) : null}
      {counted.map(([label, value]) => (value === null ? null : <ListRow key={label} label={label} value={value} />))}
    </>
  );
}

export function WorkerMetricsReport({ data }: { data: unknown }) {
  const { t } = useI18n();
  const reading = readWorkerMetrics(data);
  if (!reading) return null;
  const errorRate = reading.requests > 0 ? (reading.errors / reading.requests) * 100 : 0;

  return (
    <>
      <FigureBand
        figures={[
          [t("ui.operations.workerRequests"), formatCount(reading.requests)],
          [t("ui.operations.workerErrors"), formatCount(reading.errors)],
          [t("ui.operations.workerCpuP50"), reading.cpuP50 === null ? "—" : formatMilliseconds(reading.cpuP50)],
          [t("ui.operations.workerCpuP99"), reading.cpuP99 === null ? "—" : formatMilliseconds(reading.cpuP99)],
        ]}
      />
      <ListRow label={t("ui.operations.workerErrorRate")} tone={errorRate > 1 ? "danger" : "default"} value={`${errorRate.toFixed(2)}%`} />
      <ListRow label={t("ui.operations.workerSubrequests")} value={formatCount(reading.subrequests)} />
      {reading.statuses.map((entry) => (
        <ListRow
          key={entry.status}
          label={<span className="font-mono text-sm">{entry.status}</span>}
          tone={entry.errors > 0 ? "danger" : "default"}
          value={formatCount(entry.requests)}
        />
      ))}
    </>
  );
}

const SEVERE_LEVELS = new Set(["error", "fatal", "warn"]);

export function WorkerLogReport({ data }: { data: unknown }) {
  const { t } = useI18n();
  const events = readWorkerLogs(data);
  if (events.length === 0) return <ListRow label={t("ui.operations.logEmpty")} />;

  return (
    <>
      {events.map((event) => (
        <ListRow
          detail={[event.requestId ?? event.id, [event.origin, event.region].filter(Boolean).join(" · ")].filter(Boolean).join(" — ")}
          key={event.id}
          label={event.level ?? t("ui.operations.provider.logs")}
          tone={SEVERE_LEVELS.has(event.level ?? "") ? "danger" : "default"}
          value={`${event.duration === null ? "" : `${event.duration} ms · `}${event.startedAt ? formatDate(event.startedAt) : ""}`}
        />
      ))}
    </>
  );
}
