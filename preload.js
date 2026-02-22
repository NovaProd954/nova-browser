const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nova', {
  // Tab management
  newTab: (url) => ipcRenderer.invoke('new-tab', url),
  switchTab: (id) => ipcRenderer.invoke('switch-tab', id),
  closeTab: (id) => ipcRenderer.invoke('close-tab', id),
  getState: () => ipcRenderer.invoke('get-state'),

  // Navigation
  navigate: (id, url) => ipcRenderer.invoke('navigate', { id, url }),
  goBack: (id) => ipcRenderer.invoke('go-back', id),
  goForward: (id) => ipcRenderer.invoke('go-forward', id),
  reload: (id) => ipcRenderer.invoke('reload', id),
  stop: (id) => ipcRenderer.invoke('stop', id),
  canGoBack: (id) => ipcRenderer.invoke('can-go-back', id),
  canGoForward: (id) => ipcRenderer.invoke('can-go-forward', id),

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Events
  onTabUpdated: (cb) => ipcRenderer.on('tab-updated', (e, data) => cb(data)),
  onUrlChanged: (cb) => ipcRenderer.on('url-changed', (e, data) => cb(data)),
  onTabCreated: (cb) => ipcRenderer.on('tab-created', (e, data) => cb(data)),
});
