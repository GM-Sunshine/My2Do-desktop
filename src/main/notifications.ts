import { net, Notification } from 'electron';
import Store from 'electron-store';
import log from 'electron-log';
import { APP_URL, UNREAD_POLL_MS } from './config';
import { persistentSession, showMainWindow } from './windows';
import { updateBadge } from './tray';

interface UnreadItem {
  id: string;
  type: string | null;
  message: string;
  task_id: number | null;
  created_at: string | null;
}
interface UnreadResponse {
  count: number;
  latest: UnreadItem[];
}

const store = new Store<{ lastSeenId: string | null }>({
  name: 'notifications',
  defaults: { lastSeenId: null },
});

let timer: ReturnType<typeof setInterval> | null = null;
let started = false;

function fetchUnread(): Promise<UnreadResponse | null> {
  return new Promise((resolve) => {
    const request = net.request({
      method: 'GET',
      url: `${APP_URL}/desktop/unread`,
      session: persistentSession(),
      useSessionCookies: true, // send the persistent partition's login cookie
    });
    request.setHeader('Accept', 'application/json');

    let body = '';
    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        resolve(null); // not logged in / redirected — try again next tick
        return;
      }
      response.on('data', (chunk) => (body += chunk.toString()));
      response.on('end', () => {
        try {
          resolve(JSON.parse(body) as UnreadResponse);
        } catch {
          resolve(null);
        }
      });
    });
    request.on('error', (err) => {
      log.warn('[unread] request failed', err.message);
      resolve(null);
    });
    request.end();
  });
}

function fire(items: UnreadItem[]): void {
  if (!Notification.isSupported()) return;
  const shown = items.slice(0, 3);
  for (const item of shown) {
    const n = new Notification({ title: 'My2Do', body: item.message });
    n.on('click', () => showMainWindow('/dashboard'));
    n.show();
  }
  const extra = items.length - shown.length;
  if (extra > 0) {
    new Notification({ title: 'My2Do', body: `and ${extra} more notification${extra === 1 ? '' : 's'}` }).show();
  }
}

async function poll(): Promise<void> {
  const data = await fetchUnread();
  if (!data) return;

  updateBadge(data.count);

  const lastSeen = store.get('lastSeenId');
  // latest[0] is newest; collect everything newer than the last-seen id.
  const fresh: UnreadItem[] = [];
  for (const item of data.latest) {
    if (item.id === lastSeen) break;
    fresh.push(item);
  }
  if (data.latest.length > 0) {
    store.set('lastSeenId', data.latest[0].id);
  }
  // First run just records a baseline so we don't notify for pre-existing items.
  if (lastSeen && fresh.length > 0) fire(fresh);
}

export function startNotificationPolling(): void {
  if (started) return;
  started = true;
  void poll();
  timer = setInterval(() => void poll(), UNREAD_POLL_MS);
}

export function stopNotificationPolling(): void {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

/** Poll again shortly (e.g. right after a quick-add or a fresh login). */
export function refreshUnreadSoon(): void {
  setTimeout(() => void poll(), 800);
}
