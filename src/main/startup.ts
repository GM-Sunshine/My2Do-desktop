import { app } from 'electron';

export function isLaunchAtLogin(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}

export function setLaunchAtLogin(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true, // macOS: start to the tray/background
    args: ['--hidden'], // win/linux: our own "start hidden" flag
  });
}
