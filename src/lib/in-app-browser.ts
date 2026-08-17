export type InAppBrowserName =
  | 'LINE'
  | 'Facebook'
  | 'Messenger'
  | 'Instagram'
  | 'Threads'
  | 'TikTok'
  | 'WeChat'
  | 'Google'
  | 'Android WebView';

const browserPatterns: Array<[InAppBrowserName, RegExp]> = [
  ['LINE', /\bLine\//i],
  ['Messenger', /\bFBAN\/MessengerForiOS|\bFB_IAB\/Messenger|\bMessengerLiteForiOS/i],
  ['Facebook', /\bFBAN\/|\bFBAV\/|\bFB_IAB\/FB4A/i],
  ['Instagram', /\bInstagram\b/i],
  ['Threads', /\bBarcelona\b|\bThreads\b/i],
  ['TikTok', /\bBytedanceWebview\b|\bTikTok\b|\bmusical_ly\b/i],
  ['WeChat', /\bMicroMessenger\b/i],
  ['Google', /\bGSA\//i],
  ['Android WebView', /(?:;\s*wv\)|\bVersion\/4\.0\b.*\bChrome\/.*\bMobile Safari\/)/i],
];

export function detectInAppBrowser(userAgent: string): InAppBrowserName | null {
  return browserPatterns.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? null;
}

export function tryRedirectToExternalBrowser(userAgent: string): boolean {
  if (typeof window === 'undefined') return false;

  const browser = detectInAppBrowser(userAgent);
  if (!browser) return false;

  const currentUrl = new URL(window.location.href);

  if (browser === 'LINE') {
    if (!currentUrl.searchParams.has('openExternalBrowser')) {
      currentUrl.searchParams.set('openExternalBrowser', '1');
      window.location.replace(currentUrl.toString());
      return true;
    }
    return false;
  }

  if (!/Android/i.test(userAgent)) return false;

  const redirectState = currentUrl.searchParams.get('intent_redirected');
  if (redirectState === 'final_fallback') return false;

  const host = currentUrl.host;
  const pathname = currentUrl.pathname;
  const search = currentUrl.search;
  const hash = currentUrl.hash;
  const scheme = currentUrl.protocol.replace(':', '');

  if (redirectState !== 'chrome_fallback') {
    const fallbackUrl = new URL(window.location.href);
    fallbackUrl.searchParams.set('intent_redirected', 'chrome_fallback');
    window.location.href =
      `intent://${host}${pathname}${search}${hash}`
      + `#Intent;scheme=${scheme};package=com.android.chrome;`
      + `S.browser_fallback_url=${encodeURIComponent(fallbackUrl.toString())};end`;
    return true;
  }

  const fallbackUrl = new URL(window.location.href);
  fallbackUrl.searchParams.set('intent_redirected', 'final_fallback');
  window.location.href =
    `intent://${host}${pathname}${search}${hash}`
    + `#Intent;scheme=${scheme};action=android.intent.action.VIEW;`
    + 'category=android.intent.category.BROWSABLE;'
    + `S.browser_fallback_url=${encodeURIComponent(fallbackUrl.toString())};end`;
  return true;
}
