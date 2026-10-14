"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppNavigate, useRecordId } from "@/hooks/use-app-location";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { deleteFacility, facilityKeys, getFacility, toggleFacilityAffected } from "@/services/facilities";
import type { FacilityRecord } from "@/types";
import { dropEntity, patchEntity } from "@/lib/query-client";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { feedHref } from "@/lib/feed-href";
import { useOptimisticReaction } from "@/hooks/use-optimistic-reaction";

export function useFacilityDetail() {
  const { id: facilityId } = useRecordId("facility");
  const navigate = useAppNavigate();
  const { t } = useI18n();
  const [deleting, setDeleting] = React.useState(false);
  const query = useQuery({
    // A report being deleted is not read again while the screen leaves it.
    enabled: !deleting,
    queryKey: facilityKeys.detail(facilityId),
    queryFn: ({ signal }) => getFacility(facilityId, signal),
  });
  const currentFacility = query.data;
  const reaction = useOptimisticReaction();
  const [statusOpen, setStatusOpen] = React.useState(false);
  const deleteFeedback = useActionFeedback();

  async function toggleAffected() {
    if (!currentFacility) return;
    return reaction.run({
      id: currentFacility.id,
      previous: { active: currentFacility.currentUserAffected, count: currentFacility.affectedCount },
      apply: ({ active, count }) =>
        patchEntity<FacilityRecord>("facilities", currentFacility.id, { affectedCount: count, currentUserAffected: active }),
      request: async () => {
        const result = await toggleFacilityAffected(currentFacility.id);
        return { active: result.affected, count: result.affectedCount };
      },
      errorMessage: t("ui.facility.affectedFailed"),
    });
  }

  async function remove() {
    if (!currentFacility) return;
    setDeleting(true);
    try {
      await deleteFeedback.run(() => deleteFacility(currentFacility.id));
      dropEntity("facilities", currentFacility.id);
      toast.success(t("facility.facilityReportDeleted"));
      navigate(feedHref("facilities", currentFacility.categoryId), { replace: true });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
      setDeleting(false);
    }
  }

  return {
    affecting: reaction.isBusy(facilityId),
    burst: reaction.burstById[facilityId] ?? 0,
    deleteFeedbackState: deleteFeedback.state,
    error: query.error ? query.error.message || t("ui.facility.notFound") : "",
    facility: currentFacility,
    reload: () => void query.refetch(),
    loading: query.isLoading,
    remove,
    setFacility: (next: FacilityRecord) => patchEntity<FacilityRecord>("facilities", next.id, next),
    setStatusOpen,
    statusOpen,
    toggleAffected,
  };
}
