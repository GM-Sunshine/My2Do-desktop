import { app } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';

/**
 * Auto-update via the GitHub Releases feed (see electron-builder.yml `publish`).
 * Only runs in packaged production builds. NOTE: macOS auto-update requires a
 * Developer-ID-signed + notarized build — until then Mac users update manually.
 */
export function initUpdater(): void {
  if (!app.isPackaged) return;

  autoUpdater.logger = log;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => log.warn('[updater]', err?.message ?? err));
  autoUpdater.on('update-downloaded', (info) => log.info('[updater] downloaded', info.version));

  void autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => void autoUpdater.checkForUpdates(), 6 * 60 * 60 * 1000); // every 6h
}

export function checkForUpdates(): void {
  if (!app.isPackaged) {
    log.info('[updater] skipped — not a packaged build');
    return;
  }
  void autoUpdater.checkForUpdatesAndNotify();
}
