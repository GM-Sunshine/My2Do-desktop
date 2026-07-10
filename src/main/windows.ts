import { app, BrowserWindow, screen, session, Session } from 'electron';
import * as path from 'path';
import { APP_URL, PARTITION, userAgentSuffix } from './config';
import { attachLinkHandling } from './links';

let mainWindow: BrowserWindow | null = null;
let quickAddWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
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
  void mainWindow.loadURL(`${APP_URL}/dashboard`);

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
  // Not logged in → quick-add redirects to /login; bounce to the main window instead.
  quickAddWindow.webContents.on('did-navigate', (_e, url) => {
    if (url.includes('/login')) {
      quickAddWindow?.hide();
      showMainWindow('/login');
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
