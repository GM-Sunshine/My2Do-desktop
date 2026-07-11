import { contextBridge, ipcRenderer } from 'electron';

// Bridge for the native splash/sign-in screen. The web app only reads isDesktop.
contextBridge.exposeInMainWorld('my2doDesktop', {
  isDesktop: true,
  // 'google' → straight to Google; omit → full login page (Google + email/password).
  startLogin: (provider?: string) => ipcRenderer.invoke('auth:start', provider),
  openSite: () => ipcRenderer.invoke('open:site'),
  onAuthState: (cb: (state: string) => void) => {
    ipcRenderer.on('auth:state', (_e, state: string) => cb(state));
  },
  // Splash pulls the current state on load (robust against a missed push).
  getAuthState: (): Promise<string> => ipcRenderer.invoke('auth:state:get'),
});

// ---------------------------------------------------------------------------
// Custom window chrome. The window is frameless (no OS titlebar), so inject a
// slim draggable titlebar with minimize / maximize / close on every page —
// remote app and local splash alike — and reserve its height so nothing is
// hidden underneath. Re-runs on SPA navigations, which can drop the elements.
// ---------------------------------------------------------------------------
const TITLEBAR_HEIGHT = 34;

function ensureChrome(): void {
  if (!document.head || !document.body) return;

  if (!document.getElementById('m2d-chrome-style')) {
    const style = document.createElement('style');
    style.id = 'm2d-chrome-style';
    style.textContent = `
      body { padding-top: ${TITLEBAR_HEIGHT}px !important; }
      #m2d-titlebar { position: fixed; top: 0; left: 0; right: 0; height: ${TITLEBAR_HEIGHT}px;
        z-index: 2147483647; display: flex; align-items: stretch; justify-content: flex-end;
        -webkit-app-region: drag; }
      #m2d-titlebar .m2d-btn { -webkit-app-region: no-drag; width: 46px; height: 100%;
        display: grid; place-items: center; border: 0; padding: 0; margin: 0; background: transparent;
        cursor: pointer; color: #7a756b; transition: background .12s ease, color .12s ease; }
      #m2d-titlebar .m2d-btn:hover { background: rgba(120,120,120,.18); }
      #m2d-titlebar .m2d-close:hover { background: #e5484d; color: #fff; }
      #m2d-titlebar .m2d-btn svg { width: 15px; height: 15px; pointer-events: none; display: block; }
    `;
    document.head.appendChild(style);
  }

  if (!document.getElementById('m2d-titlebar')) {
    const bar = document.createElement('div');
    bar.id = 'm2d-titlebar';
    bar.innerHTML = `
      <button class="m2d-btn m2d-min" title="Minimize" aria-label="Minimize">
        <svg viewBox="0 0 12 12"><rect x="2" y="5.4" width="8" height="1.3" fill="currentColor"/></svg>
      </button>
      <button class="m2d-btn m2d-max" title="Maximize" aria-label="Maximize">
        <svg viewBox="0 0 12 12"><rect x="2.4" y="2.4" width="7.2" height="7.2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>
      <button class="m2d-btn m2d-close" title="Close" aria-label="Close">
        <svg viewBox="0 0 12 12"><path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      </button>`;
    document.documentElement.appendChild(bar);

    bar.querySelector('.m2d-min')?.addEventListener('click', () => ipcRenderer.send('window:minimize'));
    bar.querySelector('.m2d-max')?.addEventListener('click', () => ipcRenderer.send('window:maximize'));
    bar.querySelector('.m2d-close')?.addEventListener('click', () => ipcRenderer.send('window:close'));
  }
}

window.addEventListener('DOMContentLoaded', ensureChrome);
document.addEventListener('livewire:navigated', ensureChrome); // Livewire SPA nav
setInterval(ensureChrome, 1500); // safety net for body/DOM swaps
