# Nova Browser

A sleek, minimal Electron-based browser with a dark theme and the Nova home UI.

## Features

- 🌑 Pure black theme with white text throughout
- 🗂️ Full tab management (create, close, switch)
- 🔗 Smart URL bar with search suggestions
- 🔒 HTTPS lock / HTTP warning indicators
- ⌨️ Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+L, Ctrl+R)
- 🏠 Beautiful Nova home page (your custom design)
- 🖥️ Custom frameless window with native controls
- ↩️ Back / Forward / Reload navigation
- 🔄 Loading indicator in tabs and URL bar

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (bundled with Node.js)

### Install

```bash
cd nova-browser
npm install
```

### Run

```bash
npm start
```

### Build distributable

```bash
npm run build
```

This will produce platform-specific installers in the `dist/` folder.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | New Tab |
| `Ctrl+W` | Close Tab |
| `Ctrl+L` | Focus URL bar |
| `Ctrl+R` | Reload page |
| `Enter` in URL bar | Navigate |
| `↑ / ↓` in URL bar | Navigate suggestions |
| `Escape` | Close suggestions |

## File Structure

```
nova-browser/
├── main.js       — Electron main process (window & tab management)
├── preload.js    — Secure IPC bridge
├── index.html    — Browser chrome (tabs, nav bar, URL bar)
├── home.html     — Nova home page
├── package.json  — Project config & build settings
└── README.md     — This file
```

## Notes

- Uses `BrowserView` for each tab — this is the correct Electron approach for embedding web content without CORS issues
- Navigation to bare hostnames (e.g. `github.com`) auto-prepends `https://`
- Search queries are sent to Google by default
- The home page (`nova://home`) loads `home.html` locally
