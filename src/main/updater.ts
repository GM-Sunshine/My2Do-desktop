import { app, dialog, ipcMain, shell } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import { refreshTray } from './tray';
import { getMainWindow } from './windows';

const DOWNLOAD_PAGE = 'https://my2do.app/download';

let manualCheck = false;
let wired = false;
let pendingVersion: string | null = null; // available, but we can't self-install it

// Update state mirrored to the renderer, which shows the in-app banner (see the
// main preload). 'downloaded' = ready to restart & install (Win/AppImage);
// 'manual' = a newer version the user must download (.deb / macOS).
type UpdateStatus = 'idle' | 'downloading' | 'downloaded' | 'manual';
interface UpdateState { status: UpdateStatus; version: string | null; percent: number }
let state: UpdateState = { status: 'idle', version: null, percent: 0 };

function setState(next: Partial<UpdateState>): void {
  state = { ...state, ...next };
  getMainWindow()?.webContents.send('update:state', state);
}

/**
 * Platforms where electron-updater can download AND install in place:
 * Windows (NSIS) and Linux AppImage. A .deb/.rpm install can't self-update, and
 * macOS needs a signed + notarized build — those get a "Download" prompt instead.
 */
function canAutoInstall(): boolean {
  if (process.platform === 'win32') return true;
  if (process.platform === 'linux') return !!process.env.APPIMAGE;
  return false;
}

/** A newer version the user must download manually (null if none / auto-updating). */
export function pendingUpdate(): string | null {
  return pendingVersion;
}

export function openDownloadPage(): void {
  void shell.openExternal(DOWNLOAD_PAGE);
}

/**
 * Auto-update via the GitHub Releases feed (see electron-builder.yml `publish`).
 * Checks on launch and every 6h. Only runs in packaged builds.
 */
export function initUpdater(): void {
  if (!app.isPackaged) return;

  autoUpdater.logger = log;
  autoUpdater.autoDownload = false; // we decide per-platform in 'update-available'
  autoUpdater.autoInstallOnAppQuit = true;
  wireEvents();

  // Renderer ↔ updater bridge for the in-app banner (main preload injects it).
  ipcMain.handle('update:get', () => state);
  ipcMain.on('update:restart', () => {
    (app as unknown as { isQuitting?: boolean }).isQuitting = true;
    setImmediate(() => autoUpdater.quitAndInstall());
  });
  ipcMain.on('update:download', () => openDownloadPage());

  void autoUpdater.checkForUpdates();
  setInterval(() => {
    manualCheck = false;
    void autoUpdater.checkForUpdates();
  }, 6 * 60 * 60 * 1000);
}

function wireEvents(): void {
  if (wired) return;
  wired = true;

  autoUpdater.on('update-available', (info) => {
    log.info('[updater] available', info.version);
    if (canAutoInstall()) {
      setState({ status: 'downloading', version: info.version, percent: 0 });
      if (manualCheck) {
        void dialog.showMessageBox({
          type: 'info', title: 'My2Do',
          message: `Downloading My2Do ${info.version}…`,
          detail: 'You’ll be asked to restart when it’s ready.',
        });
      }
      void autoUpdater.downloadUpdate();
    } else {
      pendingVersion = info.version; // e.g. a .deb install
      setState({ status: 'manual', version: info.version });
      refreshTray();
      if (manualCheck) {
        manualCheck = false;
        void promptDownload(info.version);
      }
    }
  });

  autoUpdater.on('update-not-available', () => {
    pendingVersion = null;
    setState({ status: 'idle', version: null, percent: 0 });
    refreshTray();
    if (manualCheck) {
      manualCheck = false;
      void dialog.showMessageBox({
        type: 'info', title: 'My2Do',
        message: 'You’re up to date.',
        detail: `My2Do ${app.getVersion()} is the latest version.`,
      });
    }
  });

  autoUpdater.on('download-progress', (p) => {
    setState({ percent: Math.round(p.percent) });
    log.info(`[updater] ${Math.round(p.percent)}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    log.info('[updater] downloaded', info.version);
    setState({ status: 'downloaded', version: info.version, percent: 100 });
    const { response } = await dialog.showMessageBox({
      type: 'info', buttons: ['Restart & install', 'Later'], defaultId: 0, cancelId: 1,
      title: 'Update ready',
      message: `My2Do ${info.version} is ready.`,
      detail: 'The app will restart to finish installing.',
    });
    if (response === 0) {
      (app as unknown as { isQuitting?: boolean }).isQuitting = true;
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });

  autoUpdater.on('error', (err) => {
    log.warn('[updater] error', err?.message ?? err);
    if (manualCheck) {
      manualCheck = false;
      void dialog.showMessageBox({
        type: 'error', title: 'My2Do',
        message: 'Couldn’t check for updates.',
        detail: 'Please try again later, or download the latest version from my2do.app/download.',
      });
    }
  });
}

async function promptDownload(version: string): Promise<void> {
  const { response } = await dialog.showMessageBox({
    type: 'info', buttons: ['Download', 'Later'], defaultId: 0, cancelId: 1,
    title: 'Update available',
    message: `My2Do ${version} is available.`,
    detail: `You’re on ${app.getVersion()}. Download the new version to update.`,
  });
  if (response === 0) openDownloadPage();
}

/** Manual "Check for updates…" — always gives visible feedback. */
export function checkForUpdates(): void {
  if (!app.isPackaged) {
    void dialog.showMessageBox({
      type: 'info', title: 'My2Do',
      message: 'Updates are available in the installed app.',
      detail: `You’re running a development build (${app.getVersion()}).`,
    });
    return;
  }
  manualCheck = true;
  void autoUpdater.checkForUpdates();
}
