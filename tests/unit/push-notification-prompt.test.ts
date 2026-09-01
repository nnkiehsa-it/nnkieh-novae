import { describe, expect, it } from "vitest";
import { shouldOfferPushNotificationPrompt } from "../../src/lib/pwa-install";

describe("push notification prompt eligibility", () => {
  it("offers the prompt on desktop when permission has not been requested", () => {
    expect(shouldOfferPushNotificationPrompt({
      isMobilePlatform: false,
      isStandalone: false,
      permission: "default",
      supported: true,
    })).toBe(true);
  });

  it("offers the prompt to an installed mobile PWA", () => {
    expect(shouldOfferPushNotificationPrompt({
      isMobilePlatform: true,
      isStandalone: true,
      permission: "default",
      supported: true,
    })).toBe(true);
  });

  it("leaves mobile browser users in the install flow", () => {
    expect(shouldOfferPushNotificationPrompt({
      isMobilePlatform: true,
      isStandalone: false,
      permission: "default",
      supported: true,
    })).toBe(false);
  });

  it.each(["granted", "denied"] as const)(
    "does not prompt when browser permission is %s",
    (permission) => {
      expect(shouldOfferPushNotificationPrompt({
        isMobilePlatform: false,
        isStandalone: false,
        permission,
        supported: true,
      })).toBe(false);
    },
  );

  it("does not prompt when push is unsupported", () => {
    expect(shouldOfferPushNotificationPrompt({
      isMobilePlatform: false,
      isStandalone: false,
      permission: "default",
      supported: false,
    })).toBe(false);
  });
});
