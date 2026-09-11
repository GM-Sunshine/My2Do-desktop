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
  // Update state (also surfaced by the injected in-app banner below).
  onUpdateState: (cb: (s: UpdateInfo) => void) => {
    ipcRenderer.on('update:state', (_e, s: UpdateInfo) => cb(s));
  },
  getUpdateState: (): Promise<UpdateInfo> => ipcRenderer.invoke('update:get'),
  restartToUpdate: () => ipcRenderer.send('update:restart'),
  downloadUpdate: () => ipcRenderer.send('update:download'),
});

interface UpdateInfo { status: 'idle' | 'downloading' | 'downloaded' | 'manual'; version: string | null; percent: number }

// ---------------------------------------------------------------------------
// Custom window chrome. The window is frameless (no OS titlebar), so inject a
// slim draggable titlebar with minimize / maximize / close on every page —
// remote app and local splash alike — and reserve its height so nothing is
// hidden underneath. Re-runs on SPA navigations, which can drop the elements.
// ---------------------------------------------------------------------------
const TITLEBAR_HEIGHT = 34;
const UPDATE_BAR_HEIGHT = 42;

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
      #m2d-update { position: fixed; top: ${TITLEBAR_HEIGHT}px; left: 0; right: 0; height: ${UPDATE_BAR_HEIGHT}px;
        z-index: 2147483646; display: none; align-items: center; gap: 10px; padding: 0 14px;
        background: #1e4635; color: #f7f3ea; -webkit-app-region: no-drag;
        font: 500 13px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      #m2d-update.show { display: flex; }
      #m2d-update .m2d-u-dot { width: 7px; height: 7px; border-radius: 50%; background: #3ecf8e; flex: 0 0 auto; }
      #m2d-update .m2d-u-msg { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #m2d-update .m2d-u-btn { border: 0; border-radius: 7px; padding: 6px 14px; cursor: pointer;
        background: #3ecf8e; color: #04120b; font: 600 12.5px system-ui, sans-serif; }
      #m2d-update .m2d-u-btn:hover { filter: brightness(1.06); }
      #m2d-update .m2d-u-later { border: 0; background: transparent; color: #bcd0c3; cursor: pointer;
        padding: 6px 8px; font: 600 12.5px system-ui, sans-serif; }
      #m2d-update .m2d-u-later:hover { color: #f7f3ea; }
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

// ---------------------------------------------------------------------------
// In-app update banner. Mirrors the main updater's state (updater.ts). Injected
// like the titlebar, so it needs no web-app change and survives SPA navigations.
// 'downloaded' → Restart to update (Win/AppImage). 'manual' → Download (.deb/mac).
// ---------------------------------------------------------------------------
let updateDismissed: string | null = null;

function reserveForBanner(on: boolean): void {
  const id = 'm2d-update-pad';
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (on) {
    if (!el && document.head) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    if (el) el.textContent = `body { padding-top: ${TITLEBAR_HEIGHT + UPDATE_BAR_HEIGHT}px !important; }`;
  } else if (el) {
    el.remove();
  }
}

function renderUpdateBanner(s: UpdateInfo | null | undefined): void {
  if (!document.documentElement) return;
  let bar = document.getElementById('m2d-update');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'm2d-update';
    document.documentElement.appendChild(bar);
  }
  const barEl = bar;
  const status = s ? s.status : 'idle';
  if (!s || status === 'idle' || status === updateDismissed) {
    barEl.classList.remove('show');
    reserveForBanner(false);
    return;
  }

  let msg = '';
  let action = '';
  if (status === 'downloaded') { msg = 'A new version of My2Do is ready.'; action = 'restart'; }
  else if (status === 'manual') { msg = `My2Do ${s.version ?? ''} is available.`.replace(/\s+/g, ' ').trim(); action = 'download'; }
  else if (status === 'downloading') { msg = `Downloading update… ${s.percent || 0}%`; }
  else { barEl.classList.remove('show'); reserveForBanner(false); return; }

  barEl.innerHTML =
    '<span class="m2d-u-dot"></span>' + `<span class="m2d-u-msg">${msg}</span>` +
    (action === 'restart' ? '<button class="m2d-u-btn" data-a="restart">Restart to update</button>' : '') +
    (action === 'download' ? '<button class="m2d-u-btn" data-a="download">Download</button>' : '') +
    '<button class="m2d-u-later" data-a="later">Later</button>';

  barEl.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      const a = b.getAttribute('data-a');
      if (a === 'restart') ipcRenderer.send('update:restart');
      else if (a === 'download') ipcRenderer.send('update:download');
      else { updateDismissed = status; barEl.classList.remove('show'); reserveForBanner(false); }
    });
  });

  barEl.classList.add('show');
  reserveForBanner(true);
}

function pullUpdateState(): void {
  ipcRenderer.invoke('update:get').then((s) => renderUpdateBanner(s as UpdateInfo)).catch(() => {});
}

ipcRenderer.on('update:state', (_e, s: UpdateInfo) => {
  if (s && s.status !== updateDismissed) updateDismissed = null;
  renderUpdateBanner(s);
});
window.addEventListener('DOMContentLoaded', pullUpdateState);
document.addEventListener('livewire:navigated', pullUpdateState);
