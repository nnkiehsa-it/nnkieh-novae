import * as v from "valibot";
import { REALTIME_EVENTS, type RealtimeEventName, type RealtimePayload } from "../../../../shared/contracts/realtime.ts";

export type RealtimeDelivery = {
  [E in RealtimeEventName]: { event: E; id: string; payload: RealtimePayload<E>; topic: string };
}[RealtimeEventName];

/** A message for the sockets on `topic`, shaped by the contract the client reads it with. */
export function realtimeDelivery<E extends RealtimeEventName>(event: E, id: string, topic: string, payload: unknown) {
  return { event, id, payload: v.parse(REALTIME_EVENTS[event], payload), topic } as RealtimeDelivery;
}
