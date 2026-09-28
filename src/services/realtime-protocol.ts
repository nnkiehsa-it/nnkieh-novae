import { getFirebaseIdToken } from '@/lib/auth-token';
import { apiGatewayUrl } from '@/lib/api-gateway';
import { auth } from '@/lib/firebase';
import { withRequestTimeout } from '@/lib/request';
import { backendSecurityHeaders } from '@/lib/backend-security';

interface RealtimeTicketEnvelope {
  data?: { expiresAtMs?: number; ticket?: string; url?: string };
  success?: boolean;
}

export interface RealtimeMessage {
  event: string;
  id: string;
  payload: Record<string, unknown>;
  topic: string;
}

export function normalizeMessage(value: unknown): RealtimeMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.event !== 'string' || typeof record.id !== 'string' || typeof record.topic !== 'string'
    || !record.payload || typeof record.payload !== 'object' || Array.isArray(record.payload)) return null;
  return { event: record.event, id: record.id, payload: record.payload as Record<string, unknown>, topic: record.topic };
}

export function requestRealtimeTicket(uid: string, parentSignal: AbortSignal) {
  return withRequestTimeout(async (signal) => {
    const token = await getFirebaseIdToken();
    if (!token || auth?.currentUser?.uid !== uid) throw new Error('unauthenticated');
    const response = await fetch(apiGatewayUrl('/v1/realtime/ticket'), {
      method: 'POST',
      headers: { ...(await backendSecurityHeaders(token)), 'Content-Type': 'application/json' },
      body: '{}', signal,
    });
    const envelope = await response.json().catch(() => null) as RealtimeTicketEnvelope | null;
    const ticket = envelope?.data?.ticket;
    const url = envelope?.data?.url;
    if (!response.ok || envelope?.success !== true || !ticket || !url) throw new Error('notification-realtime-unavailable');
    return { ticket, url };
  }, { label: 'notification.realtimeConnection', signal: parentSignal });
}
