import { resetRouteRequestScope } from '@/lib/route-request';

export async function resetAppConnection() {
  resetRouteRequestScope();
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}
