const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
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

  tabs.push({ id, view, url, title: 'New Tab', favicon: null, loading: false });
  mainWindow.addBrowserView(view);

  const bounds = mainWindow.getBounds();
  view.setBounds({ x: 0, y: 100, width: bounds.width, height: bounds.height - 100 });
  view.setAutoResize({ width: true, height: true });

  view.webContents.on('did-start-loading', () => {
    updateTab(id, { loading: true });
    mainWindow.webContents.send('tab-updated', { id, loading: true });
  });

  view.webContents.on('did-stop-loading', () => {
    const tab = tabs.find(t => t.id === id);
    if (tab) {
      const currentUrl = view.webContents.getURL();
      const currentTitle = view.webContents.getTitle();
      updateTab(id, { loading: false, url: currentUrl, title: currentTitle || 'New Tab' });
      mainWindow.webContents.send('tab-updated', { id, loading: false, url: currentUrl, title: currentTitle || 'New Tab' });
      mainWindow.webContents.send('url-changed', { id, url: currentUrl });
    }
  });

  view.webContents.on('page-title-updated', (e, title) => {
    updateTab(id, { title });
    mainWindow.webContents.send('tab-updated', { id, title });
  });

  view.webContents.on('did-navigate', (e, url) => {
    updateTab(id, { url });
    mainWindow.webContents.send('url-changed', { id, url });
  });

  view.webContents.on('did-navigate-in-page', (e, url) => {
    updateTab(id, { url });
    mainWindow.webContents.send('url-changed', { id, url });
  });

  view.webContents.on('new-window', (e, newUrl) => {
    e.preventDefault();
    createTab(newUrl);
    switchTab(tabIdCounter);
    mainWindow.webContents.send('tab-created', { id: tabIdCounter });
  });

  if (url === 'nova://home') {
    view.webContents.loadFile('home.html');
  } else {
    view.webContents.loadURL(url);
  }

  return id;
}

function updateTab(id, data) {
  const tab = tabs.find(t => t.id === id);
  if (tab) Object.assign(tab, data);
}

function switchTab(id) {
  activeTabId = id;
  const bounds = mainWindow.getBounds();

  tabs.forEach(tab => {
    if (tab.id === id) {
      tab.view.setBounds({ x: 0, y: 100, width: bounds.width, height: bounds.height - 100 });
      mainWindow.setTopBrowserView(tab.view);
    } else {
      tab.view.setBounds({ x: 0, y: 100, width: 0, height: 0 });
    }
  });
}

function closeTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;

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

// IPC Handlers
ipcMain.handle('new-tab', (e, url) => {
  const id = createTab(url || 'nova://home');
  switchTab(id);
  return { id, tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url, loading: t.loading })) };
});

ipcMain.handle('switch-tab', (e, id) => {
  switchTab(id);
  activeTabId = id;
  const tab = tabs.find(t => t.id === id);
  return { activeTabId, url: tab?.url };
});

ipcMain.handle('close-tab', (e, id) => {
  const newActive = closeTab(id);
  return { activeTabId: newActive, tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url, loading: t.loading })) };
});

ipcMain.handle('navigate', (e, { id, url }) => {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  let target = url.trim();
  if (!target.startsWith('http://') && !target.startsWith('https://') && !target.startsWith('nova://')) {
    if (target.includes('.') && !target.includes(' ')) {
      target = 'https://' + target;
    } else {
      target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
    }
  }
  if (target === 'nova://home') {
    tab.view.webContents.loadFile('home.html');
  } else {
    tab.view.webContents.loadURL(target);
  }
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

ipcMain.handle('get-state', () => {
  return {
    tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url, loading: t.loading })),
    activeTabId,
  };
});

ipcMain.handle('can-go-back', (e, id) => {
  const tab = tabs.find(t => t.id === id);
  return tab?.view.webContents.canGoBack() ?? false;
});

ipcMain.handle('can-go-forward', (e, id) => {
  const tab = tabs.find(t => t.id === id);
  return tab?.view.webContents.canGoForward() ?? false;
});

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

mainWindow?.on('resize', () => {
  const bounds = mainWindow.getBounds();
  tabs.forEach(tab => {
    if (tab.id === activeTabId) {
      tab.view.setBounds({ x: 0, y: 100, width: bounds.width, height: bounds.height - 100 });
    }
  });
});

app.whenReady().then(() => {
  createWindow();
  const firstTabId = createTab('nova://home');
  activeTabId = firstTabId;
  switchTab(firstTabId);

  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds();
    tabs.forEach(tab => {
      if (tab.id === activeTabId) {
        tab.view.setBounds({ x: 0, y: 100, width: bounds.width, height: bounds.height - 100 });
      } else {
        tab.view.setBounds({ x: 0, y: 100, width: 0, height: 0 });
      }
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
