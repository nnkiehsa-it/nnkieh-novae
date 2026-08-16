import { getFirebaseAppCheckToken } from "@/lib/firebase-app-check";

export async function backendSecurityHeaders(authorization: string) {
  const appCheckToken = await getFirebaseAppCheckToken();
  return {
    Authorization: `Bearer ${authorization}`,
    ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
  };
}
