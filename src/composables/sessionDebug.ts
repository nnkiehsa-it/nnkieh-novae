const authDebugLabel = '[auth-debug]';
const shouldLogAuthDebug = import.meta.env.DEV;

export function debugLog(message: string, payload?: unknown) {
  if (!shouldLogAuthDebug) {
    return;
  }

  if (payload === undefined) {
    console.info(authDebugLabel, message);
    return;
  }

  console.info(authDebugLabel, message, payload);
}
