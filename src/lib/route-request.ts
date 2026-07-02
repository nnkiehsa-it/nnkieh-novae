let routeController = new AbortController();

export function resetRouteRequestScope() {
  routeController.abort();
  routeController = new AbortController();
}

export function getRouteRequestSignal() {
  return routeController.signal;
}
