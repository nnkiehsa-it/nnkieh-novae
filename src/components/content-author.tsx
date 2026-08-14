import type { UserPublicProfile } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export function ContentAuthor({ profile }: { profile?: UserPublicProfile }) {
  if (!profile) {
    return (
      <span aria-hidden className="inline-flex min-w-0 items-center gap-1.5">
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <Skeleton className="h-3 w-16 shrink-0" />
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar size="sm">
        <AvatarImage alt={profile.displayName} src={profile.photoUrl ?? undefined} />
        <AvatarFallback>{profile.displayName.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{profile.displayName}</span>
    </span>
  );
}
