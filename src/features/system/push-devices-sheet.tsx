import * as React from "react";
import { DesktopTower, DeviceMobile, DeviceTablet, Laptop } from "@phosphor-icons/react/ssr";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { closePushDevices, usePushDeviceRequest, usePushDevices } from "@/hooks/use-push-devices";
import { formatRelativeTime } from "@/lib/format";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { ErrorState } from "@/ui/page";
import { Skeleton } from "@/ui/feedback";
import { ListGroup, ListRow } from "@/ui/list";
import { Sheet } from "@/ui/sheet";

/** What a registration's user agent says the device is, for a person to recognise it by. */
function describeDevice(userAgent: string, platform: string) {
  const system = /iPhone/u.test(userAgent) ? "iPhone"
    : /iPad/u.test(userAgent) ? "iPad"
      : /Android/u.test(userAgent) ? "Android"
        : /CrOS/u.test(userAgent) ? "ChromeOS"
          : /Macintosh|Mac OS X/u.test(userAgent) ? "Mac"
            : /Windows/u.test(userAgent) ? "Windows"
              : /Linux/u.test(userAgent) ? "Linux"
                : platform;
  const browser = /Edg(?:A|iOS)?\//u.test(userAgent) ? "Edge"
    : /Firefox|FxiOS/u.test(userAgent) ? "Firefox"
      : /Chrome|CriOS/u.test(userAgent) ? "Chrome"
        : /Safari/u.test(userAgent) ? "Safari"
          : "";
  const Icon = system === "iPhone" || system === "Android" ? DeviceMobile
    : system === "iPad" ? DeviceTablet
      : system === "Mac" || system === "ChromeOS" ? Laptop
        : DesktopTower;
  return { Icon, name: [system, browser].filter(Boolean).join(" · ") };
}

/**
 * The devices this account receives push notifications on, each removable.
 * Opened from settings, or on its own when turning push on was refused
 * because the account is at its limit; removing one there carries on with
 * turning push on.
 */
export function PushDevicesSheet() {
  const { t } = useI18n();
  const request = usePushDeviceRequest();
  const open = request !== null;
  const devices = usePushDevices(open);
  const [removing, setRemoving] = React.useState<string | null>(null);
  // The request is kept while the sheet leaves, so its words do not change mid-exit.
  const [shown, setShown] = React.useState(request);
  if (request && request !== shown) setShown(request);

  async function remove(deviceId: string) {
    setRemoving(deviceId);
    try {
      await devices.remove(deviceId);
      toast.success(t("ui.pushDevices.removed"));
      const after = request?.onRemoved;
      if (request?.full) closePushDevices();
      after?.();
    } catch (caught) {
      toast.error(caught instanceof Error ? t(caught.message) : t("ui.pushDevices.removeFailed"));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Sheet
      description={shown?.full ? t("ui.pushDevices.fullDescription") : t("ui.pushDevices.description")}
      onClosed={() => setShown(null)}
      onOpenChange={(next) => { if (!next) closePushDevices(); }}
      open={open}
      title={shown?.full ? t("ui.pushDevices.fullTitle") : t("ui.pushDevices.title")}
    >
      {devices.error ? (
        <ErrorState
          message={t(devices.error.message)}
          onRetry={() => void devices.refetch()}
          retryLabel={t("common.retry")}
          title={t("ui.pushDevices.loadFailed")}
        />
      ) : !devices.devices ? (
        <div className="grid gap-2">
          <Skeleton className="h-14 rounded-panel" />
          <Skeleton className="h-14 rounded-panel" />
        </div>
      ) : (
        <ListGroup
          footer={t("ui.pushDevices.limit", { count: devices.devices.length, limit: devices.limit ?? 0 })}
          label={t("ui.pushDevices.title")}
        >
          {devices.devices.length === 0 ? (
            <ListRow detail={t("ui.pushDevices.emptyDetail")} label={t("ui.pushDevices.empty")} />
          ) : devices.devices.map((device) => {
            const { Icon, name } = describeDevice(device.userAgent, device.platform);
            const current = device.deviceId === devices.current;
            return (
              <ListRow
                detail={t("ui.pushDevices.lastActive", { time: formatRelativeTime(device.lastConfirmedAt) })}
                icon={<Icon />}
                key={device.deviceId}
                label={(
                  <span className="flex items-center gap-2">
                    <span className="truncate">{name || t("ui.pushDevices.unknown")}</span>
                    {current ? <Chip className="shrink-0">{t("ui.pushDevices.thisDevice")}</Chip> : null}
                  </span>
                )}
                trailing={(
                  <Button
                    disabled={removing !== null && removing !== device.deviceId}
                    onClick={() => void remove(device.deviceId)}
                    size="sm"
                    status={removing === device.deviceId ? "loading" : "idle"}
                    variant="danger"
                  >
                    {t("ui.pushDevices.remove")}
                  </Button>
                )}
              />
            );
          })}
        </ListGroup>
      )}
    </Sheet>
  );
}
