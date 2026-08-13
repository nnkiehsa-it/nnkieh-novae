import { t as translate } from "@/i18n";
import type { UserPublicProfile } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";

export function ContentAuthor({ profile, revealName = false }: { profile?: UserPublicProfile; revealName?: boolean }) {
  const name = profile?.displayName || translate("ui.common.schoolMember");

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar size="sm">
        <AvatarImage alt={name} src={profile?.photoUrl ?? undefined} />
        <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      {revealName ? (
        <SkeletonReveal className="min-w-16" skeleton={<Skeleton className="h-3 w-16" />}>
          <span className="truncate">{name}</span>
        </SkeletonReveal>
      ) : <span className="truncate">{name}</span>}
    </span>
  );
}
