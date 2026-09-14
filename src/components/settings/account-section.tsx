"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import type { User } from "firebase/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ListActionRow, ListCustomRow, ListSection } from "@/components/ui/list";

/**
 * Who is signed in, as the first group of the list rather than as a card of its
 * own: the identity reads, and the two things that can be done with it are rows
 * beneath it like every other setting on this screen.
 */
export function SettingsAccountSection({
  customPhotoUrl,
  onCopyUid,
  onSwitchAccount,
  user,
}: {
  customPhotoUrl: string | null;
  onCopyUid: () => void;
  onSwitchAccount: () => void;
  user: User;
}) {
  useLocaleSubscription();
  const name = user.displayName || translate("ui.settings.unnamed");
  return (
    <ListSection>
      <ListCustomRow className="flex-nowrap">
        <Avatar className="size-11 shrink-0">
          <AvatarImage alt={name} src={customPhotoUrl || user.photoURL || undefined} />
          <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-medium leading-6">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
      </ListCustomRow>
      <ListActionRow
        label={translate("ui.settings.switchAccount")}
        onClick={onSwitchAccount}
      />
      <ListActionRow
        label="UID"
        onClick={onCopyUid}
        value={<span className="font-mono text-xs">{user.uid.slice(0, 12)}…</span>}
      />
    </ListSection>
  );
}
