import { app } from 'electron';

/** Base URL of the hosted web app the wrapper loads. */
export const APP_URL = 'https://my2do.app';

/** Persistent session partition — keeps the login cookie on disk across restarts. */
export const PARTITION = 'persist:my2do';

/** Custom protocol used for the Google-sign-in-in-browser handoff. */
export const PROTOCOL = 'my2do';

/** Global shortcut that opens the quick-add mini window. */
export const QUICK_ADD_HOTKEY = 'CommandOrControl+Shift+N';

/** How often the main process polls /desktop/unread (ms). */
export const UNREAD_POLL_MS = 35_000;

/** Appended to the user-agent so Laravel can detect the desktop app. */
export const userAgentSuffix = () => `My2DoDesktop/${app.getVersion()}`;

/** Hosts allowed to open inside the app window; everything else → system browser. */
export function isInAppUrl(rawUrl: string): boolean {
  try {
    const { hostname, protocol } = new URL(rawUrl);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    if (hostname === 'my2do.app' || hostname === 'www.my2do.app') return true;
    // Stripe Checkout / billing portal render fine in Chromium and return with the cookie.
    if (hostname === 'stripe.com' || hostname.endsWith('.stripe.com')) return true;
    return false;
  } catch {
    return false;
  }
}
