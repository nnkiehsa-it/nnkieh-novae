"use client";

import * as React from "react";
import { useI18n } from "@/i18n";
import { useSession } from "@/hooks/use-session";

/** Only the latest read for the current account and view may update its screen. */
export function useAdminReading(key: string, failureKey: string) {
  const { t } = useI18n();
  const { user } = useSession();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const revision = React.useRef(0);
  const active = React.useRef<object | null>(null);
  const scope = React.useMemo(() => ({ key, uid: user?.uid }), [key, user?.uid]);

  React.useEffect(() => {
    active.current = scope;
    setLoading(false);
    setError("");
    return () => { active.current = null; revision.current += 1; };
  }, [scope]);

  const read = React.useCallback(async <T,>(fetch: (current: () => boolean) => Promise<T>, apply: (result: T) => void) => {
    if (active.current !== scope) return;
    const request = ++revision.current;
    const current = () => active.current === scope && request === revision.current;
    setLoading(true);
    setError("");
    try {
      const result = await fetch(current);
      if (current()) apply(result);
    } catch (caught) {
      if (current()) setError(caught instanceof Error ? caught.message : t(failureKey));
    } finally {
      if (current()) setLoading(false);
    }
  }, [failureKey, scope, t]);

  return { error, loading, read };
}
