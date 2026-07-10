import { app, BrowserWindow, screen, session, Session } from 'electron';
import * as path from 'path';
import { APP_URL, PARTITION, userAgentSuffix } from './config';
import { attachLinkHandling } from './links';
import { attachContextMenu } from './contextmenu';

let mainWindow: BrowserWindow | null = null;
let quickAddWindow: BrowserWindow | null = null;

/** Bundled assets (copied into dist/ by the build's postbuild step). */
const SPLASH_FILE = path.join(__dirname, '..', 'renderer', 'splash.html');
const ICON_FILE = path.join(__dirname, '..', 'icon.png');

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/** Is this the hosted web app's login page (i.e. we're signed out)? */
function isLoginUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return (u.hostname === 'my2do.app' || u.hostname === 'www.my2do.app') && u.pathname.startsWith('/login');
  } catch {
    return false;
  }
}

/** Show the native branded splash/sign-in screen in the main window. */
export function showSplash(state: 'connecting' | 'signed-out' = 'connecting'): void {
  if (!mainWindow) return;
  void mainWindow.loadFile(SPLASH_FILE);
  if (state === 'signed-out') {
    mainWindow.webContents.once('did-finish-load', () => sendAuthState('signed-out'));
  }
}

/** Load the hosted app (the signed-in experience). */
export function loadDashboard(): void {
  mainWindow?.show();
  void mainWindow?.loadURL(`${APP_URL}/dashboard`);
}

/** Tell the splash renderer whether we're connecting or signed out. */
export function sendAuthState(state: 'connecting' | 'signed-out'): void {
  mainWindow?.webContents.send('auth:state', state);
}

/** The on-disk session that holds the login + remember-me cookies. */
export function persistentSession(): Session {
  return session.fromPartition(PARTITION);
}

function preloadPath(file: string): string {
  return path.join(__dirname, '..', 'preload', file);
}

export function createMainWindow(startHidden = false): BrowserWindow {
  const ses = persistentSession();
  ses.setUserAgent(`${ses.getUserAgent()} ${userAgentSuffix()}`);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 480,
    minHeight: 480,
    show: false,
    backgroundColor: '#f7f3ea',
    title: 'My2Do',
    icon: ICON_FILE,
    autoHideMenuBar: true,
    webPreferences: {
      partition: PARTITION,
      preload: preloadPath('main.preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      webSecurity: true,
      spellcheck: true,
    },
  });

  attachLinkHandling(mainWindow.webContents);
  attachContextMenu(mainWindow.webContents);

  // Start on the native splash; main.ts runs the auth gate once it has loaded.
  void mainWindow.loadFile(SPLASH_FILE);

  // If the hosted app ever bounces us to /login (session expired, sign-out),
  // show the native sign-in screen instead of the web login page.
  mainWindow.webContents.on('did-navigate', (_e, url) => {
    if (isLoginUrl(url)) showSplash('signed-out');
  });

  mainWindow.once('ready-to-show', () => {
    if (!startHidden) mainWindow?.show();
  });
  // Close-to-tray: hide instead of quitting, unless the user chose Quit.
  mainWindow.on('close', (event) => {
    if (!(app as unknown as { isQuitting?: boolean }).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function showMainWindow(navigatePath?: string): void {
  if (!mainWindow) createMainWindow(false);
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (navigatePath) void mainWindow.loadURL(`${APP_URL}${navigatePath}`);
}

/** Load a path/URL into the main window — used by the deep-link auth handoff. */
export function loadInMainWindow(pathOrUrl: string): void {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${APP_URL}${pathOrUrl}`;
  if (!mainWindow) createMainWindow(false);
  mainWindow?.show();
  mainWindow?.focus();
  void mainWindow?.loadURL(url);
}

function positionQuickAdd(win: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint(cursor);
  const w = 600;
  const h = 150;
  win.setBounds({
    x: Math.round(workArea.x + (workArea.width - w) / 2),
    y: Math.round(workArea.y + workArea.height * 0.18),
    width: w,
    height: h,
  });
}

export function createQuickAddWindow(): BrowserWindow {
  quickAddWindow = new BrowserWindow({
    width: 600,
    height: 150,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#f7f3ea',
    webPreferences: {
      partition: PARTITION,
      preload: preloadPath('quickadd.preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      webSecurity: true,
    },
  });

  quickAddWindow.setAlwaysOnTop(true, 'floating');
  attachLinkHandling(quickAddWindow.webContents);
  positionQuickAdd(quickAddWindow);
  void quickAddWindow.loadURL(`${APP_URL}/desktop/quick-add`);

  quickAddWindow.once('ready-to-show', () => {
    quickAddWindow?.show();
    quickAddWindow?.focus();
  });
  quickAddWindow.on('blur', () => quickAddWindow?.hide());
  quickAddWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') quickAddWindow?.hide();
  });
  // Not logged in → quick-add redirects to /login; bounce to the native sign-in.
  quickAddWindow.webContents.on('did-navigate', (_e, url) => {
    if (url.includes('/login')) {
      quickAddWindow?.hide();
      showMainWindow();
      showSplash('signed-out');
    }
  });
  quickAddWindow.on('closed', () => {
    quickAddWindow = null;
  });

  return quickAddWindow;
}

export function toggleQuickAddWindow(): void {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    if (quickAddWindow.isVisible()) {
      quickAddWindow.hide();
      return;
    }
    positionQuickAdd(quickAddWindow);
    void quickAddWindow.loadURL(`${APP_URL}/desktop/quick-add`); // fresh, empty form
    quickAddWindow.show();
    quickAddWindow.focus();
    return;
  }
  createQuickAddWindow();
}

export function hideQuickAddWindow(): void {
  quickAddWindow?.hide();
}
