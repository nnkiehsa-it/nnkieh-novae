"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { useIssueComposer } from "@/hooks/use-entry-composer";
import { ComposerField } from "@/components/composer-fields";
import { ComposerLayout } from "@/components/composer-layout";

export default function IssueComposerPage() {
  useLocaleSubscription();
  const form = useIssueComposer();
  const busy = form.saving || form.images.uploading;
  return (
    <ComposerLayout
      busy={busy}
      onBack={form.back}
      onSubmit={form.submit}
      submitBusyLabel={translate('ui.issue.submitting')}
      submitDisabled={
        !form.config ||
        !form.title.trim() ||
        !form.content.trim() ||
        !form.contentWithinLimit ||
        busy
      }
      submitLabel={translate('ui.issue.submit')}
      succeeded={form.succeeded}
      title={translate('ui.issue.new')}
    >
      <ComposerField
        attachments={form.images.images}
        attachmentsUploading={form.images.uploading}
        content={form.content}
        contentLabel={translate('ui.issue.contentLabel')}
        onContentChange={form.setContent}
        onPickImages={(files) => void form.images.pick(files)}
        onRemoveImage={form.images.remove}
        onTitleChange={form.setTitle}
        placeholder={translate('ui.issue.contentPlaceholder')}
        title={form.title}
        titleLabel={translate('ui.issue.titleLabel')}
        titlePlaceholder={translate('ui.issue.titlePlaceholder')}
      />
    </ComposerLayout>
  );
}
