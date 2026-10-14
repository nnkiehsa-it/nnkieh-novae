let routeController = new AbortController();

export function getRouteRequestSignal() {
  return routeController.signal;
}
