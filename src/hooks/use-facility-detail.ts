"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import {
  deleteFacility,
  getFacility,
  peekFacility,
  toggleFacilityAffected,
} from "@/services/facilities";
import type { FacilityRecord } from "@/types";
import {
  beginContentEntityRead,
  getDetailContentEntity,
  mergeContentEntityRead,
  patchContentEntity,
} from "@/lib/content-entity-store";
import { useContentEntity } from "@/hooks/use-content-entity";
import { useContentInvalidationRefresh } from "@/hooks/use-content-invalidation-refresh";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { returnToPreviousRoute } from "@/lib/navigation-memory";
import { useColdDataReveal } from "@/hooks/use-cold-data-reveal";
import { toggleReactionState } from "@/lib/reaction-state";

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
    "detail",
  );
  const currentFacility = storedFacility ?? peekFacility(params.facilityId);
  const [coldRead] = React.useState(() => !currentFacility);
  const [loading, setLoading] = React.useState(!currentFacility);
  const revealDetail = useColdDataReveal(coldRead, loading);
  const [error, setError] = React.useState("");
  const [affecting, setAffecting] = React.useState(false);
  const affectingRef = React.useRef(false);
  const [burst, setBurst] = React.useState(0);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const deleteFeedback = useActionFeedback();
  const deletingRef = React.useRef(false);

  const load = React.useCallback(
    async (forceRefresh = false) => {
      const cached =
        getDetailContentEntity<FacilityRecord>(session.user?.uid, "facility", params.facilityId) ??
        peekFacility(params.facilityId);
      const coldRead = !cached;
      if (coldRead) setLoading(true);
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
    if (!currentFacility || affectingRef.current) return;
    const previous = {
      active: currentFacility.currentUserAffected,
      count: currentFacility.affected_count,
    };
    const optimistic = toggleReactionState(previous);
    affectingRef.current = true;
    setAffecting(true);
    patchContentEntity<FacilityRecord>(
      session.user?.uid,
      "facility",
      currentFacility.id,
      {
        affected_count: optimistic.count,
        currentUserAffected: optimistic.active,
      },
    );
    if (optimistic.active) setBurst((value) => value + 1);
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
    } catch {
      patchContentEntity<FacilityRecord>(
        session.user?.uid,
        "facility",
        currentFacility.id,
        {
          affected_count: previous.count,
          currentUserAffected: previous.active,
        },
      );
      toast.error(t("ui.facility.affectedFailed"));
    } finally {
      affectingRef.current = false;
      setAffecting(false);
    }
  }

  async function remove() {
    if (!currentFacility) return;
    deletingRef.current = true;
    try {
      await deleteFeedback.run(async () => {
        await deleteFacility(currentFacility.id);
        patchContentEntity<FacilityRecord>(
          session.user?.uid,
          "facility",
          currentFacility.id,
          { deleting: true },
        );
      });
      toast.success(t("facility.facilityReportDeleted"));
      router.replace(
        `/facilities?category=${encodeURIComponent(
          search.get("category") || currentFacility.category_id,
        )}`,
      );
    } catch (caught) {
      patchContentEntity<FacilityRecord>(
        session.user?.uid,
        "facility",
        currentFacility.id,
        { deleting: false },
      );
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
      deletingRef.current = false;
    }
  }

  return {
    affecting,
    back: () => {
      if (currentFacility)
        returnToPreviousRoute(
          router,
          `/facilities?category=${encodeURIComponent(currentFacility.category_id)}`,
          "/facilities",
        );
    },
    burst,
    deleteFeedbackState: deleteFeedback.state,
    error,
    facility: currentFacility,
    load,
    loading,
    revealDetail,
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
