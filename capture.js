// Standalone Electron screenshot harness (run under xvfb). Logs the demo user in
// via a one-time token, then captures the real app window content to PNGs.
const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Headless (xvfb) stability switches.
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-setuid-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.disableHardwareAcceleration();

const APP_URL = 'https://my2do.app';
const OUT = process.env.OUT_DIR || '/tmp/shots';
const TOKEN = process.env.TOKEN || '';
const PARTITION = 'persist:capture';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function load(win, url, settle = 3000) {
  await win.loadURL(url);
  await wait(settle);
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const ses = session.fromPartition(PARTITION);
  ses.setUserAgent(ses.getUserAgent() + ' My2DoDesktop/0.1.0');

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    backgroundColor: '#f7f3ea',
    webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false },
  });

  // Pre-accept cookies so the consent banner doesn't cover the screenshot.
  await ses.cookies.set({ url: APP_URL, name: 'cookie_consent', value: 'accepted', path: '/' });

  if (TOKEN) await load(win, `${APP_URL}/desktop/auth/consume?token=${TOKEN}`, 3500);
  await load(win, `${APP_URL}/dashboard`, 4000);
  fs.writeFileSync(path.join(OUT, 'dashboard.png'), (await win.webContents.capturePage()).toPNG());
  console.log('saved dashboard.png');

  await load(win, `${APP_URL}/board`, 3500);
  fs.writeFileSync(path.join(OUT, 'board.png'), (await win.webContents.capturePage()).toPNG());
  console.log('saved board.png');

  // Quick-add mini window, with a sample typed in so the parse preview shows.
  const qa = new BrowserWindow({
    width: 600,
    height: 150,
    frame: false,
    show: true,
    backgroundColor: '#f7f3ea',
    webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false },
  });
  await load(qa, `${APP_URL}/desktop/quick-add`, 3000);
  await qa.webContents.executeJavaScript(`(() => {
    const i = document.querySelector('input[type=text]');
    if (i) { i.focus(); i.value = 'Call Sam tomorrow 5pm #Product'; i.dispatchEvent(new Event('input', { bubbles: true })); }
  })()`);
  await wait(2500); // let the Livewire preview update
  fs.writeFileSync(path.join(OUT, 'quickadd.png'), (await qa.webContents.capturePage()).toPNG());
  console.log('saved quickadd.png');

  app.quit();
}).catch((e) => {
  console.error('capture failed', e);
  app.quit();
});
