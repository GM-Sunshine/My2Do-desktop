import { shell, WebContents } from 'electron';
import { isInAppUrl } from './config';

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
 */
export function attachLinkHandling(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (isInAppUrl(url)) return { action: 'allow' };
    openExternal(url);
    return { action: 'deny' };
  });

  const guard = (event: Electron.Event, url: string) => {
    if (!isInAppUrl(url)) {
      event.preventDefault();
      openExternal(url);
    }
  };

  contents.on('will-navigate', (e, url) => guard(e, url));
  contents.on('will-redirect', (e, url) => guard(e, url));
}
