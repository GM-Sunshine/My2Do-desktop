import { net, shell } from 'electron';
import { randomBytes } from 'crypto';
import log from 'electron-log';
import { AUTH_START_URL, AUTH_POLL_URL } from './config';
import { loadInMainWindow } from './windows';

let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Sign in: open Google in the system browser with a random `state`, then poll
 * the server until it has a login token for that state. When it arrives, load
 * the consume URL in the app window to establish the real session. Works even
 * if the browser was already logged in, and needs no protocol handler.
 */
export function startDesktopLogin(provider?: string): void {
  const state = randomBytes(24).toString('hex');
  // provider=google jumps straight to Google; otherwise the browser shows the
  // full login page (Google + email/password). Either way the app polls for the token.
  const suffix = provider === 'google' ? '&provider=google' : '';
  void shell.openExternal(`${AUTH_START_URL}?state=${state}${suffix}`);
  beginPolling(state);
}

function beginPolling(state: string): void {
  stopPolling();
  const startedAt = Date.now();

  const tick = () => {
    if (Date.now() - startedAt > 180_000) {
      log.info('[auth] sign-in polling timed out');
      stopPolling();
      return;
    }
    const request = net.request(`${AUTH_POLL_URL}?state=${state}`);
    request.on('response', (response) => {
      let body = '';
      response.on('data', (chunk) => (body += chunk.toString()));
      response.on('end', () => {
        let token = '';
        try {
          token = JSON.parse(body)?.token ?? '';
        } catch {
          /* not ready yet — keep polling */
        }
        if (token) {
          stopPolling();
          loadInMainWindow(`/desktop/auth/consume?token=${encodeURIComponent(token)}`);
        }
      });
    });
    request.on('error', () => {
      /* transient network error — keep polling */
    });
    request.end();
  };

  pollTimer = setInterval(tick, 2000);
  tick(); // check once right away (already-signed-in resolves near-instantly)
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
