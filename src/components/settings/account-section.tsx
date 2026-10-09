"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import type { User } from "firebase/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ListActionRow, ListRow, ListSection } from "@/components/ui/list";

/**
 * Who is signed in, as the first group of the list rather than as a card of its
 * own: the identity reads, and the two things that can be done with it are rows
 * beneath it like every other setting on this screen.
 */
export function SettingsAccountSection({
  customPhotoUrl,
  onCopyUid,
  user,
}: {
  customPhotoUrl: string | null;
  onCopyUid: () => void;
  user: User;
}) {
  useLocaleSubscription();
  const name = user.displayName || translate("ui.settings.unnamed");
  return (
    <ListSection>
      <ListRow label={name} value={<span className="max-w-40 truncate text-xs">{user.email}</span>} media={
        <Avatar className="size-11">
          <AvatarImage alt={name} src={customPhotoUrl || undefined} />
          <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
        </Avatar>
      } />
      <ListActionRow
        label="UID"
        onClick={onCopyUid}
        value={<span className="font-mono text-xs">{user.uid.slice(0, 12)}…</span>}
      />
    </ListSection>
  );
}
