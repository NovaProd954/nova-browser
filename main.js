const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let tabs = [];
let activeTabId = null;
let tabIdCounter = 0;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#000000',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');

  // Resize handler registered right after window creation (not at module scope)
  mainWindow.on('resize', () => {
    const [width, height] = mainWindow.getContentSize();
    tabs.forEach(tab => {
      if (tab.id === activeTabId) {
        tab.view.setBounds({ x: 0, y: 100, width, height: height - 100 });
      } else {
        tab.view.setBounds({ x: 0, y: 100, width: 0, height: 0 });
      }
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTab(url = 'nova://home') {
  const id = ++tabIdCounter;

  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  tabs.push({ id, view, url, title: 'New Tab', loading: false });
  mainWindow.addBrowserView(view);

  const [width, height] = mainWindow.getContentSize();
  view.setBounds({ x: 0, y: 100, width, height: height - 100 });
  view.setAutoResize({ width: true, height: true });

  view.webContents.on('did-start-loading', () => {
    updateTab(id, { loading: true });
    safeSend('tab-updated', { id, loading: true });
  });

  view.webContents.on('did-stop-loading', () => {
    const currentUrl = view.webContents.getURL();
    const currentTitle = view.webContents.getTitle() || 'New Tab';
    updateTab(id, { loading: false, url: currentUrl, title: currentTitle });
    safeSend('tab-updated', { id, loading: false, url: currentUrl, title: currentTitle });
    safeSend('url-changed', { id, url: currentUrl });
  });

  view.webContents.on('page-title-updated', (e, title) => {
    updateTab(id, { title });
    safeSend('tab-updated', { id, title });
  });

  view.webContents.on('did-navigate', (e, url) => {
    updateTab(id, { url });
    safeSend('url-changed', { id, url });
  });

  view.webContents.on('did-navigate-in-page', (e, url) => {
    updateTab(id, { url });
    safeSend('url-changed', { id, url });
  });

  // Use setWindowOpenHandler instead of deprecated 'new-window' event
  view.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    createTab(newUrl);
    switchTab(tabIdCounter);
    safeSend('tab-created', { id: tabIdCounter });
    return { action: 'deny' };
  });

  if (url === 'nova://home') {
    view.webContents.loadFile('home.html');
  } else {
    view.webContents.loadURL(url);
  }

  return id;
}

function safeSend(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function updateTab(id, data) {
  const tab = tabs.find(t => t.id === id);
  if (tab) Object.assign(tab, data);
}

function switchTab(id) {
  activeTabId = id;
  const [width, height] = mainWindow.getContentSize();
  tabs.forEach(tab => {
    if (tab.id === id) {
      tab.view.setBounds({ x: 0, y: 100, width, height: height - 100 });
      mainWindow.setTopBrowserView(tab.view);
    } else {
      tab.view.setBounds({ x: 0, y: 100, width: 0, height: 0 });
    }
  });
}

function closeTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return activeTabId;

  const tab = tabs[idx];
  mainWindow.removeBrowserView(tab.view);
  tab.view.webContents.destroy();
  tabs.splice(idx, 1);

  if (tabs.length === 0) {
    const newId = createTab('nova://home');
    switchTab(newId);
    return newId;
  }

  if (activeTabId === id) {
    const newActive = tabs[Math.min(idx, tabs.length - 1)];
    switchTab(newActive.id);
    return newActive.id;
  }

  return activeTabId;
}

function tabInfo(t) {
  return { id: t.id, title: t.title, url: t.url, loading: t.loading };
}

// ── IPC Handlers ──

ipcMain.handle('new-tab', (e, url) => {
  const id = createTab(url || 'nova://home');
  switchTab(id);
  return { id, tabs: tabs.map(tabInfo) };
});

ipcMain.handle('switch-tab', (e, id) => {
  switchTab(id);
  activeTabId = id;
  const tab = tabs.find(t => t.id === id);
  return { activeTabId, url: tab?.url };
});

ipcMain.handle('close-tab', (e, id) => {
  const newActive = closeTab(id);
  return { activeTabId: newActive, tabs: tabs.map(tabInfo) };
});

ipcMain.handle('navigate', (e, { id, url }) => {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return null;

  let target = url.trim();

  if (target === 'nova://home') {
    tab.view.webContents.loadFile('home.html');
    updateTab(id, { url: 'nova://home' });
    return 'nova://home';
  }

  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    if (target.includes('.') && !target.includes(' ')) {
      target = 'https://' + target;
    } else {
      target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
    }
  }

  tab.view.webContents.loadURL(target);
  updateTab(id, { url: target });
  return target;
});

ipcMain.handle('go-back', (e, id) => {
  const tab = tabs.find(t => t.id === id);
  if (tab?.view.webContents.canGoBack()) tab.view.webContents.goBack();
});

ipcMain.handle('go-forward', (e, id) => {
  const tab = tabs.find(t => t.id === id);
  if (tab?.view.webContents.canGoForward()) tab.view.webContents.goForward();
});

ipcMain.handle('reload', (e, id) => {
  const tab = tabs.find(t => t.id === id);
  if (tab) tab.view.webContents.reload();
});

ipcMain.handle('stop', (e, id) => {
  const tab = tabs.find(t => t.id === id);
  if (tab) tab.view.webContents.stop();
});

ipcMain.handle('get-state', () => ({
  tabs: tabs.map(tabInfo),
  activeTabId,
}));

ipcMain.handle('can-go-back', (e, id) => {
  const tab = tabs.find(t => t.id === id);
  return tab?.view.webContents.canGoBack() ?? false;
});

ipcMain.handle('can-go-forward', (e, id) => {
  const tab = tabs.find(t => t.id === id);
  return tab?.view.webContents.canGoForward() ?? false;
});

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// ── App lifecycle ──

app.whenReady().then(() => {
  createWindow();
  const firstId = createTab('nova://home');
  activeTabId = firstId;
  switchTab(firstId);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
