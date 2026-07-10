import { contextBridge, ipcRenderer } from 'electron';

// Minimal, safe surface. The web app detects the desktop app via the user-agent
// and only reads `isDesktop`. The rest drives the native splash/sign-in screen.
contextBridge.exposeInMainWorld('my2doDesktop', {
  isDesktop: true,

  // Splash → main: open Google sign-in in the system browser (whole flow there).
  startLogin: () => ipcRenderer.invoke('auth:start'),

  // Splash → main: open my2do.app in the system browser.
  openSite: () => ipcRenderer.invoke('open:site'),

  // Main → splash: 'connecting' | 'signed-out' (result of the auth probe).
  onAuthState: (cb: (state: string) => void) => {
    ipcRenderer.on('auth:state', (_e, state: string) => cb(state));
  },
});
