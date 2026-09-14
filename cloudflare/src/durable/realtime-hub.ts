import { DurableObject } from "cloudflare:workers";
import { jwtVerify } from "jose";
import type { Env } from "../types";

export interface RealtimeDelivery {
  event: string;
  id: string;
  payload: Record<string, unknown>;
  topic: string;
}

interface RealtimeAttachment {
  topics: string[];
  uid: string;
}

const REALTIME_PROTOCOL = "novae.realtime.v1";

function ticketFromRequest(request: Request) {
  const protocols = (request.headers.get("sec-websocket-protocol") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!protocols.includes(REALTIME_PROTOCOL)) return "";
  return protocols.find((value) => value !== REALTIME_PROTOCOL) ?? "";
}

/**
 * A close code the runtime accepts on an outgoing close frame. The codes a
 * peer can report — 1005 (no status), 1006 (no close frame, the abnormal
 * disconnect) and 1015 — may never be sent back out, so a disconnect that
 * reports one is completed as an ordinary close.
 */
function sendableCloseCode(code: number) {
  if (code === 1005 || code === 1006 || code === 1015) return 1000;
  return code >= 1000 && code <= 4999 ? code : 1000;
}

export class RealtimeHub extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    /**
     * The client heartbeats to keep the connection from being dropped in
     * silence. Answering it here means the runtime replies on its own: the
     * object stays hibernated and a ping costs no CPU time.
     */
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request: Request) {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    const ticket = ticketFromRequest(request);
    if (!ticket) return new Response("Unauthorized", { status: 401 });

    let uid = "";
    let topics: string[] = [];
    try {
      const { payload } = await jwtVerify(
        ticket,
        new TextEncoder().encode(this.env.REALTIME_TICKET_SECRET),
        { audience: "novae-realtime", issuer: "novae-api" },
      );
      uid = typeof payload.sub === "string" ? payload.sub : "";
      topics = Array.isArray(payload.topics)
        ? payload.topics.filter((topic): topic is string => typeof topic === "string").slice(0, 8)
        : [];
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }
    if (!uid || topics.length === 0) return new Response("Unauthorized", { status: 401 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ topics, uid } satisfies RealtimeAttachment);
    server.send(JSON.stringify({ event: "ready" }));
    return new Response(null, {
      status: 101,
      headers: { "sec-websocket-protocol": REALTIME_PROTOCOL },
      webSocket: client,
    });
  }

  publish(events: RealtimeDelivery[]) {
    let delivered = 0;
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as RealtimeAttachment | null;
      if (!attachment) continue;
      for (const event of events) {
        if (!attachment.topics.includes(event.topic)) continue;
        try {
          socket.send(JSON.stringify(event));
          delivered += 1;
        } catch {
          socket.close(1011, "delivery-failed");
          break;
        }
      }
    }
    return { delivered };
  }

  webSocketClose(socket: WebSocket, code: number, reason: string, wasClean: boolean) {
    socket.close(sendableCloseCode(code), reason || (wasClean ? "closed" : "disconnected"));
  }

  webSocketError(socket: WebSocket) {
    socket.close(1011, "socket-error");
  }
}
