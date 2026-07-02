export type InAppBrowserName =
  | 'LINE'
  | 'Facebook'
  | 'Messenger'
  | 'Instagram'
  | 'Threads'
  | 'TikTok'
  | 'WeChat';

const browserPatterns: Array<[InAppBrowserName, RegExp]> = [
  ['LINE', /\bLine\//i],
  ['Messenger', /\bFBAN\/MessengerForiOS|\bFB_IAB\/Messenger|\bMessengerLiteForiOS/i],
  ['Facebook', /\bFBAN\/|\bFBAV\/|\bFB_IAB\/FB4A/i],
  ['Instagram', /\bInstagram\b/i],
  ['Threads', /\bBarcelona\b|\bThreads\b/i],
  ['TikTok', /\bBytedanceWebview\b|\bTikTok\b|\bmusical_ly\b/i],
  ['WeChat', /\bMicroMessenger\b/i],
];

export function detectInAppBrowser(userAgent: string): InAppBrowserName | null {
  return browserPatterns.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? null;
}
