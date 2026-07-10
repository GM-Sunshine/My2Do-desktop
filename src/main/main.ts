import { app, ipcMain, shell } from 'electron';
import log from 'electron-log';
import { PROTOCOL, APP_URL, AUTH_START_URL } from './config';
import {
  createMainWindow,
  showMainWindow,
  loadInMainWindow,
  hideQuickAddWindow,
  getMainWindow,
  loadDashboard,
  sendAuthState,
} from './windows';
import { isAuthenticated } from './session';
import { createTray } from './tray';
import { registerShortcuts, unregisterShortcuts } from './shortcuts';
import { initUpdater } from './updater';
import { startNotificationPolling, refreshUnreadSoon } from './notifications';

log.initialize();

const quittable = app as unknown as { isQuitting?: boolean };
const startHidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAsHidden;

// Single-instance lock — required so my2do:// deep links reach the running app.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLink = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (deepLink) handleDeepLink(deepLink);
    showMainWindow();
  });

  // macOS delivers deep links via open-url.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  app.whenReady().then(onReady).catch((e) => log.error(e));
}

function registerProtocol(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

/** Handle my2do://auth/callback?token=… — establish the session in the app window. */
function handleDeepLink(url: string): void {
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get('token');
    if (url.includes('auth/callback') && token) {
      loadInMainWindow(`/desktop/auth/consume?token=${encodeURIComponent(token)}`);
      refreshUnreadSoon();
      return;
    }
    showMainWindow();
  } catch {
    log.warn('[deeplink] could not parse', url);
  }
}

function onReady(): void {
  registerProtocol();
  createMainWindow(startHidden);
  createTray();
  registerShortcuts();
  startNotificationPolling();
  initUpdater();

  // Sign-in from the native splash → open the whole Google flow in the browser.
  ipcMain.handle('auth:start', () => void shell.openExternal(AUTH_START_URL));
  ipcMain.handle('open:site', () => void shell.openExternal(APP_URL));

  // Windows/Linux: a deep link on cold start arrives in argv. It takes priority
  // over the auth gate (it IS the sign-in completing).
  const initial = process.argv.find((a) => a.startsWith(`${PROTOCOL}://`));
  if (initial) {
    handleDeepLink(initial);
  } else {
    runAuthGate();
  }

  ipcMain.on('quickadd:saved', () => {
    hideQuickAddWindow();
    refreshUnreadSoon();
  });

  // macOS dock click.
  app.on('activate', () => showMainWindow());
}

/** Once the splash has rendered, probe the session: show the app or sign-in. */
function runAuthGate(): void {
  const win = getMainWindow();
  if (!win) return;
  win.webContents.once('did-finish-load', async () => {
    try {
      if (await isAuthenticated()) loadDashboard();
      else sendAuthState('signed-out');
    } catch (e) {
      log.warn('[auth-gate]', e);
      sendAuthState('signed-out');
    }
  });
}

// Live in the tray: don't quit when the window is closed. Only explicit Quit exits.
app.on('window-all-closed', () => {
  /* no-op: the app keeps running in the tray */
});

app.on('before-quit', () => {
  quittable.isQuitting = true;
  unregisterShortcuts();
});
