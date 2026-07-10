import { app } from 'electron';

/** Base URL of the hosted web app the wrapper loads. */
export const APP_URL = 'https://my2do.app';

/** Persistent session partition — keeps the login cookie on disk across restarts. */
export const PARTITION = 'persist:my2do';

/** Custom protocol used for the Google-sign-in-in-browser handoff. */
export const PROTOCOL = 'my2do';

/**
 * Desktop sign-in runs entirely in the system browser and is picked up by
 * polling — so it works whether or not the browser is already logged in, and
 * needs no my2do:// protocol handler. The app opens AUTH_START_URL?state=<rand>
 * and polls AUTH_POLL_URL?state=<rand> until the login token is ready.
 */
export const AUTH_START_URL = `${APP_URL}/desktop/auth/start`;
export const AUTH_POLL_URL = `${APP_URL}/desktop/auth/poll`;

/** Endpoint the splash screen polls to decide app-vs-sign-in. */
export const SESSION_PROBE_URL = `${APP_URL}/desktop/session`;

/**
 * True for the OAuth *start* URL. The whole flow must run in the system browser
 * (Google blocks Electron webviews), so we never let this navigate in-window —
 * otherwise the redirect escapes to the browser mid-flow and the session (and
 * OAuth state) is split across two places and the callback can't hand back.
 */
export function isAuthStartUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return (
      (u.hostname === 'my2do.app' || u.hostname === 'www.my2do.app') &&
      u.pathname === '/auth/google/redirect'
    );
  } catch {
    return false;
  }
}

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
