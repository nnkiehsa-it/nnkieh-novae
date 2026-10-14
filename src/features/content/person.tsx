import type { UserPublicProfile } from "@/types";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Skeleton } from "@/ui/feedback";

/** The name an account goes by; an account that never set one is shown as unnamed. */
export function usePersonName() {
  const { t } = useI18n();
  return (name: string | null) => name || t("ui.person.unnamed");
}

/** A person as a photo and a name. */
export function Person({ className, name: givenName, photoUrl, size = "md" }: {
  className?: string;
  name: string | null;
  photoUrl?: string | null;
  size?: "sm" | "md";
}) {
  const name = usePersonName()(givenName);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <Avatar className={size === "sm" ? "size-6 text-xs" : "size-9"} name={name} src={photoUrl} />
      <span className={cn("truncate font-medium", size === "sm" ? "text-sm" : "text-[0.9375rem]")}>{name}</span>
    </span>
  );
}

/** The author of a record, held as a placeholder until their profile arrives. */
export function Author({ profile }: { profile?: UserPublicProfile | null }) {
  if (!profile) {
    return (
      <span aria-hidden className="inline-flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-3.5 w-16" />
      </span>
    );
  }
  return <Person name={profile.displayName} photoUrl={profile.photoUrl} size="sm" />;
}
