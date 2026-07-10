import { contextBridge } from 'electron';

// Minimal, safe surface. The web app detects the desktop app via the
// user-agent; this just lets page JS know it's running inside the wrapper.
contextBridge.exposeInMainWorld('my2doDesktop', {
  isDesktop: true,
});
