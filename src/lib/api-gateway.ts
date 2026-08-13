const apiBaseUrl = String(process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/u, "");

export function hasApiGatewayConfig() {
  return Boolean(apiBaseUrl);
}

export function apiGatewayUrl(path: string) {
  if (!apiBaseUrl)
    throw new Error("settings.apiGatewaySettingsHaveNotBeenCompleted");
  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
