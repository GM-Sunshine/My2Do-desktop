import { shell, WebContents } from 'electron';
import { isInAppUrl, isAuthStartUrl } from './config';

/** Open a URL in the system browser, but only for safe schemes. */
function openExternal(url: string): void {
  if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:')) {
    void shell.openExternal(url);
  }
}

/**
 * Keep app hosts (my2do.app, Stripe) inside the window; send everything else —
 * Google OAuth, help, legal, social, mailto — to the system browser. Google in
 * particular MUST open externally (Electron webviews are blocked by Google).
 *
 * The one exception carved out of "in-app": the Google sign-in *start* URL. Even
 * though it lives on my2do.app, it immediately redirects to Google, so it has to
 * begin in the system browser — otherwise the flow is split across two sessions
 * and the callback can never hand the login back to the app.
 */
export function attachLinkHandling(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAuthStartUrl(url)) {
      openExternal(url);
      return { action: 'deny' };
    }
    if (isInAppUrl(url)) return { action: 'allow' };
    openExternal(url);
    return { action: 'deny' };
  });

  const guard = (event: Electron.Event, url: string) => {
    if (isAuthStartUrl(url) || !isInAppUrl(url)) {
      event.preventDefault();
      openExternal(url);
    }
  };

  contents.on('will-navigate', (e, url) => guard(e, url));
  contents.on('will-redirect', (e, url) => guard(e, url));
}
