import type { ResolvedDomainEvent, WriteOutcome } from "./domain-events.ts";

/** What a facility report announces. */
export function facilityEvents(outcome: WriteOutcome): ResolvedDomainEvent[] | null {
  const { action, payload, actorUid, res, resFacility } = outcome;
  const events: ResolvedDomainEvent[] = [];
  switch (action) {
    case "createFacility": {
      const facilityId = String(resFacility.id ?? res.id ?? "");
      events.push({
        aggregateType: "facility",
        aggregateId: facilityId,
        eventType: "facility.created",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          facility_id: facilityId,
          title: String(resFacility.title ?? res.title ?? payload.title ?? ""),
          author_uid: actorUid,
          category_id: String(resFacility.categoryId ?? resFacility.category_id ?? res.categoryId ?? res.category_id ?? payload.category ?? payload.categoryId ?? ""),
        },
      });
      break;
    }
    case "updateFacilityStatus": {
      const facilityId = String(payload.facilityId ?? "");
      events.push({
        aggregateType: "facility",
        aggregateId: facilityId,
        eventType: "facility.status_changed",
        destinations: ["notion", "in_app", "push", "realtime"],
        payload: {
          facility_id: facilityId,
          new_status: String(resFacility.status ?? res.status ?? payload.nextStatus ?? ""),
          author_uid: String(resFacility.authorUid ?? resFacility.author_uid ?? res.authorUid ?? res.author_uid ?? ""),
          title: String(resFacility.title ?? res.title ?? ""),
        },
      });
      break;
    }
    case "toggleFacilityAffected": {
      const facilityId = String(payload.facilityId ?? "");
      events.push({
        aggregateType: "facility",
        aggregateId: facilityId,
        eventType: "facility.affected_toggled",
        destinations: ["notion", "realtime"],
        payload: { facility_id: facilityId, actor_uid: actorUid },
      });
      break;
    }
    case "deleteFacility": {
      const facilityId = String(payload.facilityId ?? "");
      events.push({
        aggregateType: "facility",
        aggregateId: facilityId,
        eventType: "facility.deleted",
        destinations: ["notion", "realtime"],
        payload: { facility_id: facilityId },
      });
      break;
    }
    default:
      return null;
  }
  return events;
}
