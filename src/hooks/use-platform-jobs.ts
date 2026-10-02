"use client";

import * as React from "react";

import { listPlatformJobs, type PlatformJob } from "@/services/categories";
import { useAdminReading } from "@/hooks/use-admin-reading";
import { nextPollDelay } from "@/lib/poll-schedule";
import { subscribePlatformJobsChanged } from "@/lib/platform-job-events";

const ACTIVE_STATUSES = new Set<PlatformJob["status"]>(["pending", "processing"]);

/**
 * The background work this session asked for, while it is still running.
 *
 * It follows the work only after a save on this screen has queued some, and it
 * slows down as it goes rather than asking once a second for as long as the
 * screen is open. It also stops while the tab is hidden: nobody is reading a
 * progress bar they cannot see.
 */
export function usePlatformJobs() {
  const { error, read } = useAdminReading("platform-jobs", "ui.admin.backgroundJobsLoadFailed");
  const [entries, setEntries] = React.useState<PlatformJob[]>([]);
  const [watching, setWatching] = React.useState(false);
  const pendingRead = React.useRef<Promise<PlatformJob[] | null> | null>(null);
  React.useEffect(() => {
    setEntries([]);
    setWatching(false);
    pendingRead.current = null;
  }, [read]);

  const load = React.useCallback(async () => {
    if (pendingRead.current) return pendingRead.current;
    const pending = (async () => {
      let result: PlatformJob[] | null = null;
      await read(async () => (await listPlatformJobs()).entries, (entries) => {
        result = entries;
        setEntries(entries);
      });
      // A failed or obsolete read says nothing about whether work has finished.
      return result;
    })().finally(() => { if (pendingRead.current === pending) pendingRead.current = null; });
    pendingRead.current = pending;
    return pending;
  }, [read]);

  // Nothing is read until a save on this screen queues something. An admin
  // simply looking at a settings page should not be polling because somebody
  // else's retention cleanup happens to be running.
  React.useEffect(
    () =>
      subscribePlatformJobsChanged(() => {
        setWatching(true);
        if (document.visibilityState === "visible" && navigator.onLine) void load();
      }),
    [load],
  );

  React.useEffect(() => {
    if (!watching) return;
    let attempt = 0;
    let timer = 0;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState !== "visible" || !navigator.onLine) {
        timer = window.setTimeout(() => void tick(), nextPollDelay(attempt));
        return;
      }
      const result = await load();
      if (stopped) return;
      if (result && !result.some((entry) => ACTIVE_STATUSES.has(entry.status))) {
        setWatching(false);
        return;
      }
      attempt += 1;
      timer = window.setTimeout(() => void tick(), nextPollDelay(attempt));
    };

    timer = window.setTimeout(() => void tick(), nextPollDelay(0));
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [load, watching]);

  return { entries, error, load, watching };
}
