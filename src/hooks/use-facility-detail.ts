"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import {
  deleteFacility,
  getFacility,
  toggleFacilityAffected,
} from "@/services/facilities";
import type { FacilityRecord } from "@/types";
import {
  beginContentEntityRead,
  mergeContentEntityRead,
  patchContentEntity,
  removeContentEntity,
} from "@/lib/content-entity-store";
import { useContentEntity } from "@/hooks/use-content-entity";
import { useContentInvalidationRefresh } from "@/hooks/use-content-invalidation-refresh";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export function useFacilityDetail() {
  const params = useParams<{ facilityId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const { t } = useI18n();
  const storedFacility = useContentEntity<FacilityRecord>(
    session.user?.uid,
    "facility",
    params.facilityId,
  );
  const currentFacility = storedFacility ?? null;
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [affecting, setAffecting] = React.useState(false);
  const [burst, setBurst] = React.useState(0);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const deleteFeedback = useActionFeedback();
  const deletingRef = React.useRef(false);

  const load = React.useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError("");
      const entityReadRevision = beginContentEntityRead();
      try {
        const result = await getFacility(params.facilityId, { forceRefresh });
        mergeContentEntityRead(
          session.user?.uid,
          "facility",
          result,
          entityReadRevision,
        );
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : t("ui.facility.notFound"),
        );
      } finally {
        setLoading(false);
      }
    },
    [params.facilityId, session.user?.uid, t],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const facilityCachePrefixes = React.useMemo(
    () => [`facility-detail|${params.facilityId}`],
    [params.facilityId],
  );
  useContentInvalidationRefresh(facilityCachePrefixes, () => {
    if (!deletingRef.current) return load(true);
  });

  async function toggleAffected() {
    if (!currentFacility || affecting) return;
    setAffecting(true);
    try {
      const result = await toggleFacilityAffected(currentFacility.id);
      patchContentEntity<FacilityRecord>(
        session.user?.uid,
        "facility",
        currentFacility.id,
        {
          affected_count: result.affected_count,
          currentUserAffected: result.affected,
        },
      );
      setBurst((value) => value + 1);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
    } finally {
      setAffecting(false);
    }
  }

  async function remove() {
    if (!currentFacility) return;
    deletingRef.current = true;
    try {
      await deleteFeedback.run(async () => {
        await deleteFacility(currentFacility.id);
        removeContentEntity(session.user?.uid, "facility", currentFacility.id);
      });
      router.replace(
        `/facilities?category=${encodeURIComponent(
          search.get("category") || currentFacility.category_id,
        )}`,
      );
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
      deletingRef.current = false;
    }
  }

  return {
    affecting,
    back: () => {
      if (currentFacility)
        router.push(
          `/facilities?category=${encodeURIComponent(currentFacility.category_id)}`,
        );
    },
    burst,
    deleteFeedbackState: deleteFeedback.state,
    error,
    facility: currentFacility,
    load,
    loading,
    remove,
    setFacility: (next: FacilityRecord) => {
      patchContentEntity<FacilityRecord>(
        session.user?.uid,
        "facility",
        next.id,
        next,
      );
    },
    setStatusOpen,
    statusOpen,
    toggleAffected,
  };
}
