// ==========================================================================
// PRELOAD SCRIPT — NextAI Desktop
// Exposes safe, limited Node.js APIs to the renderer process
// ==========================================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // Window state
  onMaximize: (callback) => ipcRenderer.on('window-maximized', callback),
  onUnmaximize: (callback) => ipcRenderer.on('window-unmaximized', callback),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Native notifications
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),

  // Telemetry updates
  onTelemetryUpdate: (callback) => ipcRenderer.on('telemetry-update', (_event, data) => callback(data)),

  // Native File Dialog
  selectFile: () => ipcRenderer.invoke('dialog:openFile'),
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // Platform info
  platform: process.platform,

  // Overlay & Screen Capture API
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  hideOverlay: () => ipcRenderer.send('hide-overlay'),
  toggleOverlay: () => ipcRenderer.send('toggle-overlay'),
  onOverlayShown: (callback) => ipcRenderer.on('overlay-shown', callback),

  // Dynamic Global Shortcut API
  getGlobalShortcut: () => ipcRenderer.invoke('get-global-shortcut'),
  setGlobalShortcut: (newShortcut) => ipcRenderer.invoke('set-global-shortcut', newShortcut),
  openScreenSettings: () => ipcRenderer.invoke('open-screen-settings'),

  // Check if running in Electron
  isElectron: true
});

