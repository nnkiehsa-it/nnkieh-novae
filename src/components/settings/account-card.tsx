"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { ArrowLeftRight, Copy } from "lucide-react";
import type { User } from "firebase/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SettingsAccountCard({
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
  const name = user.displayName || translate('ui.settings.unnamed');
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex items-center gap-3 py-4">
        <Avatar className="size-11">
          <AvatarImage
            alt={name}
            src={customPhotoUrl || user.photoURL || undefined}
          />
          <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button
          aria-label={translate('ui.settings.switchAccount')}
          onClick={onSwitchAccount}
          size="icon"
          variant="outline"
        >
          <ArrowLeftRight />
        </Button>
      </CardContent>
      <div className="flex items-center gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate">UID {user.uid}</span>
        <Button
          aria-label={translate('ui.settings.copyUid')}
          onClick={onCopyUid}
          size="icon-xs"
          variant="ghost"
        >
          <Copy />
        </Button>
      </div>
    </Card>
  );
}
