import { getFirebaseIdToken } from '@/lib/auth-token';
import { apiGatewayUrl } from '@/lib/api-gateway';
import { auth } from '@/lib/firebase';
import { withRequestTimeout } from '@/lib/request';
import { backendSecurityHeaders } from '@/lib/backend-security';
import { realtimeIdleRemaining } from '@/lib/realtime-idle';

interface RealtimeTicketEnvelope {
  data?: {
    expiresAtMs?: number;
    ticket?: string;
    url?: string;
  };
  success?: boolean;
}

interface RealtimeMessage {
  event: string;
  id: string;
  payload: Record<string, unknown>;
  topic: string;
}

interface RealtimeListener {
  event: string;
  onError?: (error: Error) => void;
  onMessage: (payload: Record<string, unknown>) => void;
  onResync?: () => void;
  topic: string;
}

const REALTIME_PROTOCOL = 'novae.realtime.v1';
const listeners = new Map<number, RealtimeListener>();
const deliveredIds = new Set<string>();
const deliveredIdOrder: string[] = [];
let listenerSerial = 0;
let socket: WebSocket | null = null;
let connecting = false;
let reconnectAttempt = 0;
let reconnectTimer = 0;
let connectedBefore = false;
let sessionActive = false;
let activityTracking = false;
let idleSuspended = false;
let idleTimer = 0;
let lastActivityAt = 0;

const activityEvents = ['keydown', 'pointerdown', 'scroll', 'touchstart'] as const;

function hasRealtimeInterest() {
  return sessionActive || listeners.size > 0;
}

function shouldConnect() {
  return hasRealtimeInterest() && !idleSuspended;
}

function rememberDelivery(id: string) {
  if (!id || deliveredIds.has(id)) return false;
  deliveredIds.add(id);
  deliveredIdOrder.push(id);
  while (deliveredIdOrder.length > 500) {
    const oldest = deliveredIdOrder.shift();
    if (oldest) deliveredIds.delete(oldest);
  }
  return true;
}

function notifyError(error: Error) {
  listeners.forEach((listener) => listener.onError?.(error));
}

function scheduleReconnect() {
  if (!shouldConnect() || reconnectTimer) return;
  const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt);
  reconnectAttempt += 1;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = 0;
    ensureRealtimeConnection();
  }, delay);
}

function closeSocket() {
  window.clearTimeout(reconnectTimer);
  reconnectTimer = 0;
  connecting = false;
  const activeSocket = socket;
  socket = null;
  if (activeSocket && activeSocket.readyState < WebSocket.CLOSING) activeSocket.close(1000, 'idle');
}

function scheduleIdleCheck() {
  window.clearTimeout(idleTimer);
  idleTimer = 0;
  if (!hasRealtimeInterest()) return;
  const remaining = realtimeIdleRemaining(lastActivityAt);
  if (remaining === 0) {
    idleSuspended = true;
    closeSocket();
    return;
  }
  idleTimer = window.setTimeout(scheduleIdleCheck, remaining);
}

function recordRealtimeActivity() {
  if (document.visibilityState === 'hidden') return;
  lastActivityAt = Date.now();
  if (idleSuspended) {
    idleSuspended = false;
    ensureRealtimeConnection();
  }
  if (!idleTimer) scheduleIdleCheck();
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return;
  if (realtimeIdleRemaining(lastActivityAt) === 0) {
    idleSuspended = true;
    closeSocket();
  }
  recordRealtimeActivity();
}

function startActivityTracking() {
  if (activityTracking) return;
  activityTracking = true;
  idleSuspended = false;
  lastActivityAt = Date.now();
  activityEvents.forEach((event) =>
    window.addEventListener(event, recordRealtimeActivity, { passive: true }),
  );
  window.addEventListener('focus', recordRealtimeActivity);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  scheduleIdleCheck();
}

function stopActivityTracking() {
  if (!activityTracking || hasRealtimeInterest()) return;
  activityTracking = false;
  idleSuspended = false;
  lastActivityAt = 0;
  window.clearTimeout(idleTimer);
  idleTimer = 0;
  activityEvents.forEach((event) =>
    window.removeEventListener(event, recordRealtimeActivity),
  );
  window.removeEventListener('focus', recordRealtimeActivity);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}

function normalizeMessage(value: unknown): RealtimeMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.event !== 'string'
    || typeof record.id !== 'string'
    || typeof record.topic !== 'string'
    || !record.payload
    || typeof record.payload !== 'object'
    || Array.isArray(record.payload)
  ) return null;
  return {
    event: record.event,
    id: record.id,
    payload: record.payload as Record<string, unknown>,
    topic: record.topic,
  };
}

async function requestRealtimeTicket(uid: string) {
  const token = await getFirebaseIdToken();
  if (!token || auth?.currentUser?.uid !== uid) throw new Error('unauthenticated');
  return withRequestTimeout(async (signal) => {
    const response = await fetch(apiGatewayUrl('/v1/realtime/ticket'), {
      method: 'POST',
      headers: {
        ...(await backendSecurityHeaders(token)),
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal,
    });
    const envelope = await response.json().catch(() => null) as RealtimeTicketEnvelope | null;
    const ticket = envelope?.data?.ticket;
    const url = envelope?.data?.url;
    if (!response.ok || envelope?.success !== true || !ticket || !url) {
      throw new Error('notification-realtime-unavailable');
    }
    return { ticket, url };
  }, { label: 'notification.realtimeConnection' });
}

async function connectRealtime() {
  const uid = auth?.currentUser?.uid;
  if (!uid || !shouldConnect() || socket || connecting) return;
  connecting = true;
  try {
    const { ticket, url } = await requestRealtimeTicket(uid);
    if (auth?.currentUser?.uid !== uid || !shouldConnect()) return;
    const nextSocket = new WebSocket(url, [REALTIME_PROTOCOL, ticket]);
    socket = nextSocket;
    nextSocket.onopen = () => {
      if (socket !== nextSocket) return;
      reconnectAttempt = 0;
      if (connectedBefore) {
        const resyncCallbacks = new Set(
          Array.from(listeners.values(), (listener) => listener.onResync)
            .filter((callback): callback is () => void => Boolean(callback)),
        );
        resyncCallbacks.forEach((callback) => callback());
      }
      connectedBefore = true;
    };
    nextSocket.onmessage = (event) => {
      if (typeof event.data !== 'string' || event.data === 'pong') return;
      let message: RealtimeMessage | null = null;
      try {
        message = normalizeMessage(JSON.parse(event.data) as unknown);
      } catch {
        return;
      }
      if (!message || !rememberDelivery(message.id)) return;
      listeners.forEach((listener) => {
        if (listener.topic === message.topic && listener.event === message.event) {
          listener.onMessage(message.payload);
        }
      });
    };
    nextSocket.onerror = () => notifyError(new Error('notification-realtime-unavailable'));
    nextSocket.onclose = () => {
      if (socket !== nextSocket) return;
      socket = null;
      if (shouldConnect()) {
        notifyError(new Error('notification-realtime-unavailable'));
        scheduleReconnect();
      }
    };
  } catch (error) {
    notifyError(error instanceof Error ? error : new Error('notification-realtime-unavailable'));
    scheduleReconnect();
  } finally {
    connecting = false;
  }
}

export function ensureRealtimeConnection() {
  void connectRealtime();
}

export function startRealtimeSession() {
  sessionActive = true;
  startActivityTracking();
  ensureRealtimeConnection();
}

export function stopRealtimeSession() {
  sessionActive = false;
  if (listeners.size === 0) closeSocket();
  stopActivityTracking();
}

export function subscribeRealtimeTopic(
  topic: string,
  event: string,
  onMessage: (payload: Record<string, unknown>) => void,
  options: Pick<RealtimeListener, 'onError' | 'onResync'> = {},
) {
  const id = listenerSerial += 1;
  listeners.set(id, { event, onMessage, topic, ...options });
  startActivityTracking();
  ensureRealtimeConnection();
  return () => {
    listeners.delete(id);
    if (!shouldConnect()) closeSocket();
    stopActivityTracking();
  };
}
