import { useEffect } from "react";
import { useAppNavigate } from "@/hooks/use-app-location";

export function usePermissionRedirect(
  allowed: boolean,
  fallback = "/home",
) {
  const navigate = useAppNavigate();

  useEffect(() => {
    if (!allowed) navigate(fallback, { replace: true });
  }, [allowed, fallback, navigate]);
}
