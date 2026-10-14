import type { Announcers } from "./domain-events.ts";

/** What a facility report announces. */
export const FACILITY_ANNOUNCERS = {
  createFacility: ({ result: { facility }, actorUid }) => [{
    aggregateType: "facility",
    aggregateId: facility.id,
    eventType: "facility.created",
    destinations: ["notion", "in_app", "push", "realtime"],
    payload: { facility_id: facility.id, title: facility.title, author_uid: actorUid, category_id: facility.categoryId },
  }],
  updateFacilityStatus: ({ result: { facility } }) => [{
    aggregateType: "facility",
    aggregateId: facility.id,
    eventType: "facility.status_changed",
    destinations: ["notion", "in_app", "push", "realtime"],
    payload: { facility_id: facility.id, new_status: facility.status, author_uid: facility.authorUid, title: facility.title },
  }],
  toggleFacilityAffected: ({ input, actorUid }) => [{
    aggregateType: "facility",
    aggregateId: input.facilityId,
    eventType: "facility.affected_toggled",
    destinations: ["notion", "realtime"],
    payload: { facility_id: input.facilityId, actor_uid: actorUid },
  }],
  deleteFacility: ({ input }) => [{
    aggregateType: "facility",
    aggregateId: input.facilityId,
    eventType: "facility.deleted",
    destinations: ["notion", "realtime"],
    payload: { facility_id: input.facilityId },
  }],
} satisfies Partial<Announcers>;
