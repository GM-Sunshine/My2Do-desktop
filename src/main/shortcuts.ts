import { globalShortcut } from 'electron';
import log from 'electron-log';
import { QUICK_ADD_HOTKEY } from './config';
import { toggleQuickAddWindow } from './windows';

export function registerShortcuts(): void {
  const ok = globalShortcut.register(QUICK_ADD_HOTKEY, () => toggleQuickAddWindow());
  if (!ok) log.warn(`Could not register global shortcut ${QUICK_ADD_HOTKEY} (already in use?)`);
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
}
