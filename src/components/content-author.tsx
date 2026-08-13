import { t as translate } from "@/i18n";
import type { UserPublicProfile } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function ContentAuthor({ profile }: { profile?: UserPublicProfile }) {
  const name = profile?.displayName || translate("ui.common.schoolMember");

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar size="sm">
        <AvatarImage alt={name} src={profile?.photoUrl ?? undefined} />
        <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  );
}
