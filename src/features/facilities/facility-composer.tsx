"use client";

import { MapPin } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { INPUT_LIMITS } from "@/constants/input-limits";
import { useFacilityComposer } from "@/hooks/use-entry-composer";
import { Composer, CountedLabel } from "@/features/content/composer";
import { Input } from "@/ui/field";
import { Select } from "@/ui/select";

export function FacilityComposer() {
  const { t } = useI18n();
  const form = useFacilityComposer();
  const busy = form.saving || form.images.uploading;
  return (
    <Composer
      body={{ label: t("ui.facility.problemDescription"), onChange: form.setContent, placeholder: t("ui.facility.problemPlaceholder"), value: form.content }}
      busy={busy}
      draft={form.draft}
      images={form.images}
      onSubmit={form.submit}
      submitBusyLabel={t("ui.issue.submitting")}
      submitDisabled={!form.category || !form.title.trim() || !form.location.trim() || !form.content.trim() || !form.contentWithinLimit || busy}
      submitLabel={t("ui.facility.submit")}
      succeeded={form.succeeded}
      titleField={{ label: t("ui.facility.reportTitle"), onChange: form.setTitle, placeholder: t("ui.facility.reportTitlePlaceholder"), value: form.title }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <span className="px-1 text-sm font-medium text-ink-muted">{t("ui.access.facilityCategory")}</span>
          <Select
            label={t("ui.access.facilityCategory")}
            onChange={form.setCategory}
            options={form.categories.map((category) => ({ label: category.label, value: category.id }))}
            value={form.category}
          />
        </div>
        <div className="grid gap-2">
          <CountedLabel count={form.location.length} htmlFor="facility-location" label={t("ui.facility.location")} limit={INPUT_LIMITS.facilityLocation} />
          <div className="relative">
            <MapPin aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <Input
              className="pl-10"
              id="facility-location"
              maxLength={INPUT_LIMITS.facilityLocation}
              onChange={(event) => form.setLocation(event.target.value)}
              placeholder={t("ui.facility.locationExample")}
              value={form.location}
            />
          </div>
        </div>
      </div>
    </Composer>
  );
}
