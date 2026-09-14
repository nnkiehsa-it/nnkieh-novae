import type { UserPublicProfile } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export function PersonIdentity({
  name,
  photoUrl,
  size = "default",
}: {
  name: string;
  photoUrl?: string | null;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <Avatar size={size}>
        <AvatarImage alt={name} src={photoUrl ?? undefined} />
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm font-medium">{name}</span>
    </span>
  );
}

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
    <PersonIdentity
      name={profile.displayName}
      photoUrl={profile.photoUrl}
      size="sm"
    />
  );
}
