import { contextBridge, ipcRenderer } from 'electron';

// DOM events are shared across isolated worlds, so we can listen for the custom
// event the quick-add page fires on a successful save and tell the main process
// to hide the window + refresh the unread count.
window.addEventListener('my2do:quickadd:saved', () => {
  ipcRenderer.send('quickadd:saved');
});

contextBridge.exposeInMainWorld('my2doQuickAdd', {
  isDesktop: true,
});
