import { net } from 'electron';
import log from 'electron-log';
import { SESSION_PROBE_URL, userAgentSuffix } from './config';
import { persistentSession } from './windows';

/**
 * Ask the server — with the app's persistent cookie jar — whether we're signed
 * in. Lets the splash decide between loading the app and showing the sign-in
 * screen without ever flashing the web login page. Fails closed (signed-out).
 */
export function isAuthenticated(): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    try {
      const request = net.request({ method: 'GET', url: SESSION_PROBE_URL, session: persistentSession() });
      request.setHeader('Accept', 'application/json');
      request.setHeader('User-Agent', `${persistentSession().getUserAgent()} ${userAgentSuffix()}`);

      // Don't hang the splash on a slow network.
      const timer = setTimeout(() => done(false), 8000);

      request.on('response', (response) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk.toString()));
        response.on('end', () => {
          clearTimeout(timer);
          try {
            done(Boolean(JSON.parse(body)?.authenticated));
          } catch {
            done(false);
          }
        });
        response.on('error', () => {
          clearTimeout(timer);
          done(false);
        });
      });
      request.on('error', (e) => {
        log.warn('[session] probe failed', e?.message);
        clearTimeout(timer);
        done(false);
      });
      request.end();
    } catch (e) {
      log.warn('[session] probe threw', e);
      done(false);
    }
  });
}
