export function sessionDebug(message: string, payload?: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  console.debug(`[session] ${message}`, payload ?? "");
}
