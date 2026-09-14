import { describe, expect, it } from "vitest";

import {
  formatBytes,
  formatMilliseconds,
  percentOf,
  readCloudinaryUsage,
  readWorkerLogs,
  readWorkerMetrics,
} from "@/lib/provider-diagnostics-format";

describe("readCloudinaryUsage", () => {
  it("reads the counters out of the shapes Cloudinary nests them in", () => {
    expect(
      readCloudinaryUsage({
        bandwidth: { usage: 2048 },
        credits: { limit: 25, usage: 1.5, used_percent: 6 },
        last_updated: "2026-09-13",
        plan: "Free",
        requests: 1200,
        resources: { usage: 87 },
        storage: { usage: 1_048_576 },
        transformations: { usage: 42 },
      }),
    ).toEqual({
      bandwidthBytes: 2048,
      credits: { limit: 25, usage: 1.5 },
      lastUpdated: "2026-09-13",
      objects: 87,
      plan: "Free",
      requests: 1200,
      storageBytes: 1_048_576,
      transformations: 42,
    });
  });

  it("reports a missing figure as missing rather than as zero", () => {
    const reading = readCloudinaryUsage({ plan: "Free" });
    expect(reading?.credits).toBeNull();
    expect(reading?.storageBytes).toBeNull();
    expect(readCloudinaryUsage("nothing")).toBeNull();
  });
});

describe("readWorkerMetrics", () => {
  const envelope = (rows: unknown) => ({
    viewer: { accounts: [{ workersInvocationsAdaptive: rows }] },
  });

  it("adds a day of traffic up and weights the quantiles by request", () => {
    const reading = readWorkerMetrics(
      envelope([
        {
          dimensions: { status: "success" },
          quantiles: { cpuTimeP50: 7_000, cpuTimeP99: 40_000 },
          sum: { errors: 0, requests: 900, subrequests: 1800 },
        },
        {
          dimensions: { status: "scriptThrewException" },
          quantiles: { cpuTimeP50: 17_000, cpuTimeP99: 60_000 },
          sum: { errors: 100, requests: 100, subrequests: 50 },
        },
      ]),
    );
    expect(reading).toMatchObject({ errors: 100, requests: 1000, subrequests: 1850 });
    expect(reading?.cpuP50).toBe(8_000);
    expect(reading?.statuses[0]).toEqual({ errors: 0, requests: 900, status: "success" });
  });

  it("has nothing to report when the account answered with no rows", () => {
    expect(readWorkerMetrics(envelope([]))).toBeNull();
    expect(readWorkerMetrics({ data: null })).toBeNull();
  });
});

describe("readWorkerLogs", () => {
  it("keeps the fields an administrator can act on and dates the event", () => {
    const [event] = readWorkerLogs([
      {
        duration: 12,
        id: "abc",
        level: "error",
        origin: "fetch",
        rayId: "ray-1",
        region: "APAC",
        requestId: "req-1",
        startTime: 1_757_000_000_000,
      },
    ]);
    expect(event).toMatchObject({ duration: 12, level: "error", requestId: "req-1" });
    expect(event?.startedAt?.getTime()).toBe(1_757_000_000_000);
  });

  it("falls back to the ray identifier and survives an empty answer", () => {
    expect(readWorkerLogs([{ id: "a", rayId: "ray-9" }])[0]?.requestId).toBe("ray-9");
    expect(readWorkerLogs(null)).toEqual([]);
  });
});

describe("figures", () => {
  it("scales bytes and microseconds into units a reader can compare", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1_572_864)).toBe("1.5 MiB");
    expect(formatMilliseconds(7_400)).toBe("7.4 ms");
    expect(formatMilliseconds(120_000)).toBe("120 ms");
  });

  it("reports a share only where there is a ceiling to share of", () => {
    expect(percentOf(5, 25)).toBe(20);
    expect(percentOf(5, null)).toBeNull();
    expect(percentOf(30, 25)).toBe(100);
  });
});
