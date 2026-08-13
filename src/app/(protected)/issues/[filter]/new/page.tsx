"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { ArrowLeft, Send } from "lucide-react";
import { useIssueComposer } from "@/hooks/use-entry-composer";
import { ComposerField } from "@/components/composer-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BusyLabel, PageHeader } from "@/components/ui/page-state";

export default function IssueComposerPage() {
  useLocaleSubscription();
  const form = useIssueComposer();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        actions={
          <Button onClick={form.back} variant="ghost">
            <ArrowLeft />{translate('ui.common.back')}</Button>
        }
        title={translate('ui.issue.new')}
      />
      <form onSubmit={form.submit}>
        <Card className="py-6">
          <CardContent>
            <ComposerField
              attachments={form.images.images}
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
            <div className="mt-6 flex justify-end">
              <Button
                disabled={
                  !form.config ||
                  !form.title.trim() ||
                  !form.content.trim() ||
                  form.saving ||
                  form.images.uploading
                }
                type="submit"
              >
                <Send />
                <BusyLabel
                  busy={form.saving || form.images.uploading}
                  busyLabel={translate('ui.issue.submitting')}
                  label={translate('ui.issue.submit')}
                  success={form.succeeded}
                />
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
