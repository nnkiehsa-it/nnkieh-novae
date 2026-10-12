"use client";

import { useI18n } from "@/i18n";
import { useIssueComposer } from "@/hooks/use-entry-composer";
import { Composer } from "@/features/content/composer";

export function IssueComposer() {
  const { t } = useI18n();
  const form = useIssueComposer();
  const busy = form.saving || form.images.uploading;
  return (
    <Composer
      body={{ label: t("ui.issue.contentLabel"), onChange: form.setContent, placeholder: t("ui.issue.contentPlaceholder"), value: form.content }}
      busy={busy}
      draft={form.draft}
      images={form.images}
      onSubmit={form.submit}
      submitBusyLabel={t("ui.issue.submitting")}
      submitDisabled={!form.config || !form.title.trim() || !form.content.trim() || !form.contentWithinLimit || busy}
      submitLabel={t("ui.issue.submit")}
      succeeded={form.succeeded}
      title={t("ui.issue.new")}
      titleField={{ label: t("ui.issue.titleLabel"), onChange: form.setTitle, placeholder: t("ui.issue.titlePlaceholder"), value: form.title }}
    />
  );
}
