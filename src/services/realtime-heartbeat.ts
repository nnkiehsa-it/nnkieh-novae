import { realtimeHeartbeatInterval } from '@/lib/realtime-timing';

/**
 * A realtime connection can carry no traffic for a long time, and an idle
 * WebSocket is dropped somewhere between the browser and the Durable Object
 * without a close frame — which is what surfaces as close code 1006. The
 * heartbeat both keeps the connection warm and makes a dead one observable:
 * a ping that is not answered before the next tick means the socket is already
 * gone, so it is closed deliberately and the transport's reconnect backoff
 * takes over instead of the page waiting in silence.
 */
let timer = 0;
let awaitingResponse = false;

export function stopHeartbeat() {
  window.clearInterval(timer);
  timer = 0;
  awaitingResponse = false;
}

export function noteHeartbeatResponse() {
  awaitingResponse = false;
}

export function startHeartbeat(socket: WebSocket, isCurrent: () => boolean) {
  stopHeartbeat();
  timer = window.setInterval(() => {
    if (!isCurrent() || socket.readyState !== WebSocket.OPEN) {
      stopHeartbeat();
      return;
    }
    if (awaitingResponse) {
      socket.close(4000, 'heartbeat-timeout');
      return;
    }
    awaitingResponse = true;
    socket.send('ping');
  }, realtimeHeartbeatInterval());
}
