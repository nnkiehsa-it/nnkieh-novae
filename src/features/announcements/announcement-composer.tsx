import { useI18n } from "@/i18n";
import { useAnnouncementComposer } from "@/hooks/use-entry-composer";
import { usePermissionRedirect } from "@/hooks/use-permission-redirect";
import { feedHref } from "@/lib/feed-href";
import { Composer } from "@/features/content/composer";

export function AnnouncementComposer() {
  const { t } = useI18n();
  const form = useAnnouncementComposer();
  usePermissionRedirect(form.canManage, feedHref("announcements"));
  if (!form.canManage) return null;
  const busy = form.saving || form.images.uploading;
  return (
    <Composer
      body={{ label: t("ui.announcement.contentLabel"), onChange: form.setContent, placeholder: t("ui.announcement.contentPlaceholder"), value: form.content }}
      busy={busy}
      draft={form.draft}
      images={form.images}
      onSubmit={form.submit}
      submitBusyLabel={t("ui.announcement.publishing")}
      submitDisabled={!form.title.trim() || !form.content.trim() || !form.contentWithinLimit || busy}
      submitLabel={t("ui.announcement.publish")}
      succeeded={form.succeeded}
      titleField={{ label: t("ui.announcement.titleLabel"), onChange: form.setTitle, placeholder: t("ui.announcement.titlePlaceholder"), value: form.title }}
    />
  );
}
