"use client";

import { useRef } from "react";
import { useI18n } from "@/i18n";
import { ListNumberRow, ListSwitchRow } from "@/components/ui/list-controls";
import { ListRowGroup } from "@/components/ui/list";

/** A zero limit is the single persisted representation of disabled uploads. */
export function ImagePolicyFields({ value, onChange, comments = false }: {
  value: number;
  onChange: (value: number) => void;
  comments?: boolean;
}) {
  const { t } = useI18n();
  const lastLimit = useRef(value || (comments ? 1 : 2));
  const label = t(comments ? "admin.allowCommentImages" : "admin.allowContentImages");
  return <>
    <ListSwitchRow checked={value !== 0} label={label} name={label} onCheckedChange={(enabled) => {
      if (value > 0) lastLimit.current = value;
      onChange(enabled ? lastLimit.current : 0);
    }} />
    <ListRowGroup show={value !== 0}>
      <ListNumberRow label={t(comments ? "ui.admin.commentImageLimit" : "admin.contentImageLimit")}
        min={1} max={20} value={value} onChange={(next) => onChange(next === 0 ? Number.NaN : next)} />
    </ListRowGroup>
  </>;
}
