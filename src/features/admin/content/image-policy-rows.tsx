import { useRef } from "react";
import { useI18n } from "@/i18n";
import { NumberRow, SwitchRow } from "@/ui/list-controls";

const MAX_IMAGES = 20;

/**
 * Whether images are allowed, and how many. Zero is the one stored form of
 * "off", so switching back on restores the last limit that was set.
 */
export function ImagePolicyRows({ comments = false, onChange, value }: {
  comments?: boolean;
  onChange: (value: number) => void;
  value: number;
}) {
  const { t } = useI18n();
  const lastLimit = useRef(value || (comments ? 1 : 2));
  return (
    <>
      <SwitchRow
        checked={value !== 0}
        label={t(comments ? "admin.allowCommentImages" : "admin.allowContentImages")}
        onChange={(enabled) => {
          if (value > 0) lastLimit.current = value;
          onChange(enabled ? lastLimit.current : 0);
        }}
      />
      {value !== 0 ? (
        <NumberRow
          label={t(comments ? "ui.admin.commentImageLimit" : "admin.contentImageLimit")}
          max={MAX_IMAGES}
          min={1}
          onChange={(next) => onChange(next === 0 ? Number.NaN : next)}
          value={value}
        />
      ) : null}
    </>
  );
}
