import { describe, expect, it } from "vitest";
import { IMAGE_PRESETS, RETENTION_PRESETS, POLICY_GROUPS, policyPresets } from "@/lib/admin-setting-presets";
import { DEFAULT_OPERATION_POLICIES } from "@/generated/operations";
import { validateOperationPolicies } from "../../cloudflare/src/backend/shared/operation-policies";
import { platformSettingsFromInput } from "../../cloudflare/src/backend/shared/platform-settings";

describe("admin presets match backend contracts", () => {
  it("accepts every image and retention preset without normalization", () => {
    for (const image of IMAGE_PRESETS) for (const retention of RETENTION_PRESETS) {
      const input = { imageUploads: image.values, retention: retention.values };
      expect(platformSettingsFromInput(input)).toEqual(input);
    }
  });

  it("accepts policy profiles and confines their changes to their selected group", () => {
    for (const group of POLICY_GROUPS) for (const preset of policyPresets(group)) {
      const input = { ...DEFAULT_OPERATION_POLICIES, ...preset.values };
      expect(validateOperationPolicies(input)).toEqual(input);
      expect(policyPresets(group)[0].values).toMatchObject(Object.fromEntries(
        Object.keys(preset.values).map((key) => [key, DEFAULT_OPERATION_POLICIES[key as keyof typeof DEFAULT_OPERATION_POLICIES]]),
      ));
    }
  });
});
