let pendingTurnstileToken = "";

export function setPendingTurnstileToken(token: string | null | undefined) {
  pendingTurnstileToken = token?.trim() ?? "";
}

export function takePendingTurnstileToken() {
  const token = pendingTurnstileToken;
  pendingTurnstileToken = "";
  return token;
}
