import { app, Menu, nativeImage, Tray } from 'electron';
import * as path from 'path';
import { getMainWindow, showMainWindow, toggleQuickAddWindow } from './windows';
import { isLaunchAtLogin, setLaunchAtLogin } from './startup';
import { checkForUpdates, openDownloadPage, pendingUpdate } from './updater';

let tray: Tray | null = null;

function trayIcon(): Electron.NativeImage {
  // dist/icon.png — copied from build/ at build time so it ships inside the app
  // (build/ is a build resource and is NOT packaged into the running app).
  const img = nativeImage
    .createFromPath(path.join(__dirname, '..', 'icon.png'))
    .resize({ width: 18, height: 18 });
  if (process.platform === 'darwin') img.setTemplateImage(true); // auto light/dark on mac
  return img;
}

export function createTray(): void {
  tray = new Tray(trayIcon());
  tray.setToolTip('My2Do');
  rebuildMenu();
  // Left-click opens the app (mac uses the menu instead).
  tray.on('click', () => showMainWindow());
}

/** Rebuild the tray menu — also called by the updater when an update is found. */
export function refreshTray(): void {
  rebuildMenu();
}

function rebuildMenu(): void {
  if (!tray) return;

  const pending = pendingUpdate();
  const items: Electron.MenuItemConstructorOptions[] = [
    { label: `My2Do ${app.getVersion()}`, enabled: false },
  ];
  if (pending) {
    items.push({ label: `⬇  Update to ${pending}…`, click: () => openDownloadPage() });
  }
  items.push(
    { type: 'separator' },
    { label: 'Open My2Do', click: () => showMainWindow() },
    { label: 'Quick add task', accelerator: 'CmdOrCtrl+Shift+N', click: () => toggleQuickAddWindow() },
    { type: 'separator' },
    {
      label: 'Launch at login',
      type: 'checkbox',
      checked: isLaunchAtLogin(),
      click: (item) => setLaunchAtLogin(item.checked),
    },
    { label: 'Check for updates…', click: () => checkForUpdates() },
    { type: 'separator' },
    {
      label: 'Quit My2Do',
      click: () => {
        (app as unknown as { isQuitting?: boolean }).isQuitting = true;
        app.quit();
      },
    },
  );

  tray.setContextMenu(Menu.buildFromTemplate(items));
}

/** Reflect the unread count on the dock/launcher badge and tray tooltip. */
export function updateBadge(count: number): void {
  if (typeof app.setBadgeCount === 'function') {
    app.setBadgeCount(count); // macOS dock / Linux Unity+KDE launcher
  }
  tray?.setToolTip(count > 0 ? `My2Do — ${count} unread` : 'My2Do');
  getMainWindow()?.flashFrame(false);
}
