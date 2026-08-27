"use client";

import { ListRouteSkeleton } from "@/components/ui/route-skeleton";
import { useSession } from "@/hooks/use-session";

export default function Loading() {
  const session = useSession();
  return (
    <ListRouteSkeleton
      kind="announcement"
      showCreate={session.can("announcement.manage")}
    />
  );
}
