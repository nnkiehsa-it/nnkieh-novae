import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listPushDevices, unregisterPushToken } from "@/services/push-notifications";
import { getPushDeviceId, revokeCurrentDevicePush } from "@/services/push-token-registration";

export { isPushDeviceLimitError } from "@/services/push-notifications";

/**
 * Why the device list is open: `full` when turning push on was refused
 * because the account is at its device limit, so freeing one can carry on
 * with what the reader was doing.
 */
interface DeviceListRequest {
  full: boolean;
  /** Called after a device is removed. */
  onRemoved?: () => void;
}

let request: DeviceListRequest | null = null;
const listeners = new Set<() => void>();

function publish(next: DeviceListRequest | null) {
  request = next;
  listeners.forEach((listener) => listener());
}

/** Opens the account's push device list, from settings or from a refused registration. */
export function openPushDevices(next: DeviceListRequest = { full: false }) {
  publish(next);
}

export function closePushDevices() {
  publish(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePushDeviceRequest() {
  return React.useSyncExternalStore(subscribe, () => request, () => null);
}

const DEVICES_KEY = ["push", "devices"] as const;

/** The devices this account receives push on, and removing one. */
export function usePushDevices(enabled: boolean) {
  const client = useQueryClient();
  const query = useQuery({ enabled, queryFn: listPushDevices, queryKey: DEVICES_KEY });
  const current = React.useMemo(() => getPushDeviceId(), []);
  const remove = React.useCallback(async (deviceId: string) => {
    // This device also forgets it was registered, so it does not quietly re-register.
    if (deviceId === current) await revokeCurrentDevicePush();
    else await unregisterPushToken(deviceId);
    await client.invalidateQueries({ queryKey: DEVICES_KEY });
  }, [client, current]);
  return { current, devices: query.data?.devices, error: query.error, limit: query.data?.limit, refetch: query.refetch, remove };
}
