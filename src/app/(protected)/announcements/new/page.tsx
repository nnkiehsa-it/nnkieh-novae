"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { ArrowLeft, Send } from "lucide-react";
import { useAnnouncementComposer } from "@/hooks/use-entry-composer";
import { usePermissionRedirect } from "@/hooks/use-permission-redirect";
import { ComposerField } from "@/components/composer-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BusyLabel, ErrorState, PageHeader } from "@/components/ui/page-state";

export default function AnnouncementComposerPage() {
  useLocaleSubscription();
  const form = useAnnouncementComposer();
  usePermissionRedirect(form.canManage, "/announcements");
  if (!form.canManage)
    return <ErrorState error={translate('ui.announcement.noPublishPermission')} />;
  return (
    <div className="t-reveal-content mx-auto max-w-3xl space-y-5">
      <PageHeader
        actions={
          <Button onClick={form.back} variant="ghost">
            <ArrowLeft />{translate('ui.common.back')}</Button>
        }
        title={translate('ui.announcement.newTitle')}
      />
      <form onSubmit={form.submit}>
        <Card className="py-6">
          <CardContent>
            <ComposerField
              attachments={form.images.images}
              content={form.content}
              contentLabel={translate('ui.announcement.contentLabel')}
              onContentChange={form.setContent}
              onPickImages={(files) => void form.images.pick(files)}
              onRemoveImage={form.images.remove}
              onTitleChange={form.setTitle}
              placeholder={translate('ui.announcement.contentPlaceholder')}
              title={form.title}
              titleLabel={translate('ui.announcement.titleLabel')}
              titlePlaceholder={translate('ui.announcement.titlePlaceholder')}
            />
            <div className="mt-6 flex justify-end">
              <Button
                disabled={
                  !form.title.trim() || !form.content.trim() || form.saving || form.images.uploading
                }
                type="submit"
              >
                <Send />
                <BusyLabel
                  busy={form.saving || form.images.uploading}
                  busyLabel={translate('ui.announcement.publishing')}
                  label={translate('ui.announcement.publish')}
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
