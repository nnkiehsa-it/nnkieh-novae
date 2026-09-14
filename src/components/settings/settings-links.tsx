"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { ExternalLink, Github, RefreshCcw, ShieldCheck } from "lucide-react";
import { ListNavRow, ListActionRow, ListSection } from "@/components/ui/list";

export function ManagementLinks({ canManage }: { canManage: boolean }) {
  useLocaleSubscription();
  if (!canManage) return null;
  return (
    <ListSection header={translate("ui.settings.adminTools")}>
      <ListNavRow
        href="/admin"
        icon={ShieldCheck}
        label={translate("admin.title")}
      />
    </ListSection>
  );
}

export function ResourceLinks() {
  useLocaleSubscription();
  return (
    <ListSection header={translate("ui.settings.resources")}>
      <ListNavRow
        external
        href="https://tavricccc.github.io/novae-website/"
        icon={ExternalLink}
        label={translate("ui.settings.website")}
      />
      <ListNavRow
        external
        href="https://github.com/tavricccc/novae"
        icon={Github}
        label="GitHub"
      />
      <ListActionRow
        icon={RefreshCcw}
        label={translate("ui.settings.restart")}
        onClick={() => window.location.reload()}
      />
    </ListSection>
  );
}
