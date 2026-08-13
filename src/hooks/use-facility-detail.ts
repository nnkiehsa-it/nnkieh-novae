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
import { reconcileReactionState, recordReactionMutation } from "@/lib/reaction-state";

export function useFacilityDetail() {
  const params = useParams<{ facilityId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const { t } = useI18n();
  const [facility, setFacility] = React.useState<FacilityRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [affecting, setAffecting] = React.useState(false);
  const [burst, setBurst] = React.useState(0);
  const [statusOpen, setStatusOpen] = React.useState(false);

  const load = React.useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError("");
      try {
        const result = await getFacility(params.facilityId, { forceRefresh });
        const reaction = reconcileReactionState(
          session.user?.uid,
          "facility",
          result.id,
          { active: result.currentUserAffected === true, count: result.affected_count },
          "detail",
        );
        setFacility({
          ...result,
          affected_count: reaction.count,
          currentUserAffected: reaction.active,
        });
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

  async function toggleAffected() {
    if (!facility || affecting) return;
    setAffecting(true);
    try {
      const result = await toggleFacilityAffected(facility.id);
      recordReactionMutation(session.user?.uid, "facility", facility.id, {
        active: result.affected,
        count: result.affected_count,
      });
      setFacility({ ...facility, ...result, currentUserAffected: result.affected });
      setBurst((value) => value + 1);
      toast.success(
        result.affected
          ? t("ui.facility.markedAffected")
          : t("ui.facility.unmarkedAffected"),
      );
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
    } finally {
      setAffecting(false);
    }
  }

  async function remove() {
    if (!facility) return;
    await deleteFacility(facility.id);
    toast.success(t("ui.facility.deleted"));
    router.replace(
      `/facilities?category=${encodeURIComponent(
        search.get("category") || facility.category_id,
      )}`,
    );
  }

  return {
    affecting,
    back: () => {
      if (facility)
        router.push(`/facilities?category=${encodeURIComponent(facility.category_id)}`);
    },
    burst,
    error,
    facility,
    load,
    loading,
    remove,
    setFacility,
    setStatusOpen,
    statusOpen,
    toggleAffected,
  };
}
