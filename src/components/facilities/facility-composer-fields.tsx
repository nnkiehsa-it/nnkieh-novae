"use client";

import { useI18n } from "@/i18n";
import { INPUT_LIMITS } from "@/constants/input-limits";
import { ListPicker } from "@/components/ui/choice-select";
import { ListSection } from "@/components/ui/list";
import { ListInputRow } from "@/components/ui/list-controls";

export function FacilityComposerFields({ categories, category, location, onCategoryChange, onLocationChange, pending = false }: {
  categories: ReadonlyArray<{ id: string; label: string }>;
  category: string;
  location: string;
  onCategoryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  pending?: boolean;
}) {
  const { t } = useI18n();
  return <ListSection>
    <ListPicker label={t("ui.access.facilityCategory")} disabled={pending}
      onChange={onCategoryChange} options={categories.map(({ id, label }) => ({ label, value: id }))} value={category} />
    <ListInputRow id="facility-location" label={t("ui.facility.location")} disabled={pending}
      maxLength={INPUT_LIMITS.facilityLocation} value={location} onChange={onLocationChange}
      placeholder={t("ui.facility.locationExample")}
      info={<span className="tabular-nums">{location.length} / {INPUT_LIMITS.facilityLocation}</span>} />
  </ListSection>;
}
