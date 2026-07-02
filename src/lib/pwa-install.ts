export function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isTouchPrimaryDevice() {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

export type IosBrowserGuide = 'Chrome' | 'Google';
export type AppInstallPromptReason = 'default' | 'notifications';

export const REQUEST_APP_INSTALL_PROMPT_EVENT = 'srp:request-app-install-prompt';

function isIosDevice(userAgent: string, platform: string, maxTouchPoints: number) {
  return /iPad|iPhone|iPod/i.test(userAgent)
    || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function detectIosBrowserGuide(userAgent: string, platform: string, maxTouchPoints: number): IosBrowserGuide | null {
  if (!isIosDevice(userAgent, platform, maxTouchPoints)) return null;
  if (/\bCriOS\//i.test(userAgent)) return 'Chrome';
  if (/\bGSA\//i.test(userAgent)) return 'Google';
  return null;
}

export function isAndroidDevice(userAgent: string) {
  return /Android/i.test(userAgent);
}

function isMobilePwaRequiredPlatform(userAgent: string, platform: string, maxTouchPoints: number) {
  return isAndroidDevice(userAgent) || isIosDevice(userAgent, platform, maxTouchPoints);
}

export function shouldInstallPwaBeforePush(userAgent: string, platform: string, maxTouchPoints: number) {
  return isMobilePwaRequiredPlatform(userAgent, platform, maxTouchPoints) && !isStandaloneMode();
}

export function requestAppInstallPrompt(reason: AppInstallPromptReason = 'default') {
  window.dispatchEvent(new CustomEvent(REQUEST_APP_INSTALL_PROMPT_EVENT, { detail: { reason } }));
}

export function isIosSafari(userAgent: string, platform: string, maxTouchPoints: number) {
  const isSafari = /Safari/i.test(userAgent)
    && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Line\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|BytedanceWebview|TikTok/i.test(userAgent);

  return isIosDevice(userAgent, platform, maxTouchPoints) && isSafari;
}
