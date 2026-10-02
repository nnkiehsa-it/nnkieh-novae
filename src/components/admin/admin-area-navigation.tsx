"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";

import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ListNavRow, ListSection } from "@/components/ui/list";

export interface AdminArea {
  value: string;
  label: string;
  detail: string;
  changeCount?: number;
}

/** The same summary → working section navigation throughout administration. */
export function AdminAreaNavigation({ areas, onSelect, value }: {
  areas: readonly AdminArea[];
  onSelect: (value: string) => void;
  value: string;
}) {
  const { t } = useI18n();
  const selected = areas.find((area) => area.value === value);
  if (!selected) return (
    <ListSection groupName={t("admin.sectionSummary")}>
      {areas.map((area) => <ListNavRow key={area.value} label={area.label} detail={area.detail}
        onClick={() => onSelect(area.value)} value={area.changeCount
          ? <span className="text-sm text-[var(--tint-content)]">{t("admin.sectionChanges", { count: area.changeCount })}</span>
          : undefined} />)}
    </ListSection>
  );
  return (
    <div className="space-y-3">
      <Button onClick={() => onSelect("overview")} size="sm" variant="ghost">
        <ArrowLeft aria-hidden className="size-4" />{t("admin.backToSummary")}
      </Button>
      <div className="px-1">
        <h2 className="text-lg font-semibold">{selected.label}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{selected.detail}</p>
      </div>
    </div>
  );
}

/** Keep visited editors mounted so returning to the summary preserves drafts. */
export function AdminAreaPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [visited, setVisited] = React.useState(active);
  if (active && !visited) setVisited(true);
  if (!active && !visited) return null;
  return <div hidden={!active}>{children}</div>;
}
