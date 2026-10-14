"use client";

import * as React from "react";
import { useAppNavigate, useRecordId } from "@/hooks/use-app-location";
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
import { feedHref } from "@/lib/feed-href";
import { useColdDataReveal } from "@/hooks/use-cold-data-reveal";
import { useOptimisticReaction } from "@/hooks/use-optimistic-reaction";

export function useFacilityDetail() {
  const { id: facilityId } = useRecordId("facility");
  const navigate = useAppNavigate();
  const session = useSession();
  const { t } = useI18n();
  const storedFacility = useContentEntity<FacilityRecord>(
    session.user?.uid,
    "facility",
    facilityId,
    "detail",
  );
  const currentFacility = storedFacility ?? peekFacility(facilityId);
  const [coldRead] = React.useState(() => !currentFacility);
  const [loading, setLoading] = React.useState(!currentFacility);
  const revealDetail = useColdDataReveal(coldRead, loading);
  const [error, setError] = React.useState("");
  const reaction = useOptimisticReaction(session.user?.uid, "facility");
  const [statusOpen, setStatusOpen] = React.useState(false);
  const deleteFeedback = useActionFeedback();
  const deletingRef = React.useRef(false);

  const load = React.useCallback(
    async (forceRefresh = false) => {
      const cached =
        getDetailContentEntity<FacilityRecord>(session.user?.uid, "facility", facilityId) ??
        peekFacility(facilityId);
      const coldRead = !cached;
      if (coldRead) setLoading(true);
      setError("");
      const entityReadRevision = beginContentEntityRead();
      try {
        const result = await getFacility(facilityId, { forceRefresh: forceRefresh || !coldRead });
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
    [facilityId, session.user?.uid, t],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const facilityCachePrefixes = React.useMemo(
    () => [`facility-detail|${facilityId}`],
    [facilityId],
  );
  useContentInvalidationRefresh(facilityCachePrefixes, () => {
    if (!deletingRef.current) return load(true);
  });

  async function toggleAffected() {
    if (!currentFacility) return;
    return reaction.run({
      id: currentFacility.id,
      previous: { active: currentFacility.currentUserAffected, count: currentFacility.affectedCount },
      apply: ({ active, count }, pending) => patchContentEntity<FacilityRecord>(session.user?.uid, "facility", currentFacility.id, {
        affectedCount: count, currentUserAffected: active,
      }, { pending }),
      request: async () => {
        const result = await toggleFacilityAffected(currentFacility.id);
        return { active: result.affected, count: result.affectedCount };
      },
      errorMessage: t("ui.facility.affectedFailed"),
    });
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
      navigate(feedHref("facilities", currentFacility.categoryId), { replace: true });
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
    affecting: reaction.isBusy(facilityId),
    burst: reaction.burstById[facilityId] ?? 0,
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
