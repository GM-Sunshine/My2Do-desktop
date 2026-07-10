# My2Do Desktop

A native desktop wrapper for [my2do.app](https://my2do.app) (Windows, macOS, Linux). It
loads the existing web app in a secure Electron window and adds a native layer:
OS notifications, a tray icon with unread badge, a global quick-add hotkey,
launch-on-startup, and auto-update.

It reuses the web app's own login (session cookies persist on disk), so there is
no separate account system.

## Develop

```bash
npm install
npm start          # build + run (needs a desktop/display)
npm run typecheck  # type-check only (CI/headless)
```

## Build installers

```bash
npm run dist:linux   # AppImage + deb
npm run dist:all     # mac + win + linux (each on its own OS / CI)
```

Installers are built per-OS by the GitHub Actions matrix (`.github/workflows/release.yml`)
on a `v*` tag, and published to GitHub Releases (which is also the auto-update feed).

## Native features

- **Notifications** — polls `GET /desktop/unread` (session-cookie authed) and fires
  native notifications for new items; drives the dock/launcher badge + tray tooltip.
- **Tray** — Open · Quick add · Launch at login · Check for updates · Quit.
- **Global quick-add** — `Cmd/Ctrl+Shift+N` opens a frameless mini window at
  `/desktop/quick-add`.
- **Startup / background** — launch at login (start hidden to tray); close-to-tray.
- **Auto-update** — electron-updater from GitHub Releases.

## Google sign-in

Google blocks OAuth in Electron webviews, so the "Continue with Google" button
(with `?desktop=1`) opens the **system browser**; after consent the site redirects
to `my2do://auth/callback?token=…`, the OS hands that to this app, and the app
loads `/desktop/auth/consume?token=…` in its window to establish the real session.
Email/password login works directly in the window.

## Before first release

- Set `publish.owner` / `publish.repo` in `electron-builder.yml` to this repo.
- **Signing (later):** macOS auto-update **requires** a Developer-ID-signed +
  notarized build; until then ship the unsigned dmg for manual install. Windows
  NSIS and Linux AppImage auto-update while unsigned (Windows shows a one-time
  SmartScreen warning until signed).
