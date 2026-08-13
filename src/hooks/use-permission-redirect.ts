"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function usePermissionRedirect(
  allowed: boolean,
  fallback = "/issues",
) {
  const router = useRouter();

  useEffect(() => {
    if (!allowed) router.replace(fallback);
  }, [allowed, fallback, router]);
}
