// ==========================================================================
// ELECTRON MAIN PROCESS — NextAI Desktop App
// ==========================================================================
const { app, BrowserWindow, ipcMain, Notification, Menu, Tray, nativeImage, dialog, globalShortcut, desktopCapturer, screen, systemPreferences } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const si = require('systeminformation');

// Allow audio autoplay without user gesture (needed for TTS)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// ==========================================================================
// CONFIGURATION
// ==========================================================================
const APP_NAME = 'NextAI';
const SERVER_PORT = 5500;
const WINDOW_MIN_WIDTH = 900;
const WINDOW_MIN_HEIGHT = 600;
const WINDOW_DEFAULT_WIDTH = 1200;
const WINDOW_DEFAULT_HEIGHT = 800;

let mainWindow = null;
let overlayWindow = null;
let pythonProcess = null;
let tray = null;
let isQuitting = false;

// ==========================================================================
// PYTHON SERVER MANAGEMENT
// ==========================================================================

/**
 * Get the correct path for server.py depending on packaged vs dev mode
 */
function getServerPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'server.py');
  }
  return path.join(__dirname, 'server.py');
}

/**
 * Get the correct working directory for the Python server
 */
function getServerCwd() {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return __dirname;
}

/**
 * Find the Python executable (python3 or python)
 */
function getPythonCommand() {
  return process.platform === 'win32' ? 'python' : 'python3';
}

/**
 * Start the Python TTS server as a child process
 */
function startPythonServer() {
  return new Promise((resolve, reject) => {
    const pythonCmd = getPythonCommand();
    const serverPath = getServerPath();
    const serverCwd = getServerCwd();

    console.log(`[Electron] Starting Python server: ${pythonCmd} ${serverPath}`);
    console.log(`[Electron] Working directory: ${serverCwd}`);

    pythonProcess = spawn(pythonCmd, [serverPath], {
      cwd: serverCwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) console.log(`[Python] ${output}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) console.error(`[Python Error] ${output}`);
    });

    pythonProcess.on('error', (error) => {
      console.error(`[Electron] Failed to start Python server: ${error.message}`);
      reject(error);
    });

    pythonProcess.on('close', (code) => {
      console.log(`[Electron] Python server exited with code ${code}`);
      pythonProcess = null;
    });

    // Wait for server to be ready by polling
    waitForServer(SERVER_PORT, 30000)
      .then(() => {
        console.log(`[Electron] Python server is ready on port ${SERVER_PORT}`);
        resolve();
      })
      .catch((err) => {
        console.warn(`[Electron] Server readiness check timed out, proceeding anyway...`);
        resolve(); // Still resolve — server might start later
      });
  });
}

/**
 * Poll the server until it responds or timeout
 */
function waitForServer(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        reject(new Error('Server start timeout'));
        return;
      }

      const req = http.get(`http://localhost:${port}/api/voices`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve();
        }
      });

      req.on('error', () => {
        // Server not ready yet, keep polling
      });

      req.setTimeout(1000, () => {
        req.destroy();
      });
    }, 500);
  });
}

/**
 * Gracefully stop the Python server
 */
function stopPythonServer() {
  if (pythonProcess) {
    console.log('[Electron] Stopping Python server...');
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', pythonProcess.pid.toString(), '/f', '/t']);
    } else {
      pythonProcess.kill('SIGTERM');
      // Force kill after 3 seconds if still running
      setTimeout(() => {
        if (pythonProcess) {
          try {
            pythonProcess.kill('SIGKILL');
          } catch (e) {
            // Process already terminated
          }
        }
      }, 3000);
    }
    pythonProcess = null;
  }
}

// ==========================================================================
// WINDOW MANAGEMENT
// ==========================================================================

function createMainWindow() {
  // Load saved window bounds
  let windowBounds = { width: WINDOW_DEFAULT_WIDTH, height: WINDOW_DEFAULT_HEIGHT };
  try {
    const saved = require('fs').readFileSync(
      path.join(app.getPath('userData'), 'window-state.json'), 'utf-8'
    );
    const parsed = JSON.parse(saved);
    if (parsed.width && parsed.height) {
      windowBounds = parsed;
    }
  } catch (e) {
    // No saved state, use defaults
  }

  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    x: windowBounds.x,
    y: windowBounds.y,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    title: APP_NAME,
    titleBarStyle: 'hiddenInset', // macOS native hidden titlebar with inset traffic lights
    titleBarOverlay: process.platform === 'win32' ? {
      color: '#0a0a1a',
      symbolColor: '#e0e7ff',
      height: 40
    } : undefined,
    frame: process.platform !== 'linux', // Use frameless on Linux for custom titlebar
    backgroundColor: '#0a0a1a',
    show: false, // Show after ready-to-show
    icon: path.join(__dirname, 'assets', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      webviewTag: true,
    }
  });

  // Clear cache to ensure CSS/JS updates are applied immediately
  mainWindow.webContents.session.clearCache().then(() => {
    // Load the app from the Python HTTP server
    // This ensures relative API paths (/api/tts, /api/voices) and assets work correctly
    mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
  });

  // Show window smoothly when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Save window state on resize/move
  const saveWindowState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      const isMaximized = mainWindow.isMaximized();
      try {
        require('fs').writeFileSync(
          path.join(app.getPath('userData'), 'window-state.json'),
          JSON.stringify({ ...bounds, isMaximized })
        );
      } catch (e) {
        // Ignore write errors
      }
    }
  };

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);

  // Maximize/unmaximize events for UI updates
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized');
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-unmaximized');
  });

  // Start Telemetry Polling
  let telemetryInterval = setInterval(async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        const cpu = await si.currentLoad();
        mainWindow.webContents.send('telemetry-update', {
          cpuLoad: cpu.currentLoad
        });
      } catch (err) {
        console.error('Telemetry error:', err);
      }
    } else {
      clearInterval(telemetryInterval);
    }
  }, 2000);

  // Handle window close — hide to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Restore maximized state
  if (windowBounds.isMaximized) {
    mainWindow.maximize();
  }
}

// ==========================================================================
// FLOATING OVERLAY WINDOW (SPOTLIGHT COPILOT)
// ==========================================================================

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 760,
    height: 480,
    x: Math.round((width - 760) / 2),
    y: 90,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  overlayWindow.loadURL(`http://localhost:${SERVER_PORT}/overlay.html`);

  // Ensure window floats globally above all other OS applications & fullscreen spaces
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') {
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function toggleOverlayWindow() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow();
  }

  if (overlayWindow.isVisible()) {
    overlayWindow.hide();
  } else {
    const mousePos = screen.getCursorScreenPoint();
    const currentDisplay = screen.getDisplayNearestPoint(mousePos);
    const { x, y, width } = currentDisplay.workArea;

    overlayWindow.setPosition(
      Math.round(x + (width - 760) / 2),
      y + 90
    );

    if (process.platform === 'darwin') {
      overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.show();
    overlayWindow.focus();
    overlayWindow.webContents.send('overlay-shown');
  }
}

// ==========================================================================
// DYNAMIC GLOBAL SHORTCUT MANAGEMENT
// ==========================================================================

let currentShortcut = process.platform === 'darwin' ? 'Option+Space' : 'Alt+Space';

function getShortcutConfigPath() {
  return path.join(app.getPath('userData'), 'shortcut-config.json');
}

function loadSavedShortcut() {
  try {
    const configPath = getShortcutConfigPath();
    if (require('fs').existsSync(configPath)) {
      const data = JSON.parse(require('fs').readFileSync(configPath, 'utf-8'));
      if (data && data.shortcut) {
        currentShortcut = data.shortcut;
      }
    }
  } catch (e) {
    console.warn('[Electron] Could not load saved shortcut config:', e.message);
  }
  return currentShortcut;
}

function applyGlobalShortcut(newShortcut) {
  try {
    globalShortcut.unregisterAll();
    const registered = globalShortcut.register(newShortcut, () => {
      toggleOverlayWindow();
    });

    if (registered) {
      currentShortcut = newShortcut;
      try {
        require('fs').writeFileSync(getShortcutConfigPath(), JSON.stringify({ shortcut: newShortcut }));
      } catch (e) {
        console.warn('[Electron] Could not save shortcut config:', e.message);
      }
      console.log(`[Electron] Global shortcut updated to: ${newShortcut}`);
      return { success: true, shortcut: newShortcut };
    } else {
      console.warn(`[Electron] Failed to register new shortcut: ${newShortcut}`);
      return { success: false, error: `Gagal meregistrasi shortcut '${newShortcut}'. Mungkin digunakan aplikasi lain.` };
    }
  } catch (err) {
    console.error(`[Electron] Error registering shortcut ${newShortcut}:`, err);
    return { success: false, error: err.message };
  }
}

// ==========================================================================
// APPLICATION MENU
// ==========================================================================

function createAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: APP_NAME,
      submenu: [
        { role: 'about', label: `Tentang ${APP_NAME}` },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: `Sembunyikan ${APP_NAME}` },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: `Keluar ${APP_NAME}` }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Obrolan Baru',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.executeJavaScript('createNewConversation()');
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Tutup Window' } : { role: 'quit', label: 'Keluar' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Potong' },
        { role: 'copy', label: 'Salin' },
        { role: 'paste', label: 'Tempel' },
        { role: 'selectAll', label: 'Pilih Semua' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Muat Ulang' },
        { role: 'forceReload', label: 'Paksa Muat Ulang' },
        { role: 'toggleDevTools', label: 'Developer Tools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Ukuran Normal' },
        { role: 'zoomIn', label: 'Perbesar' },
        { role: 'zoomOut', label: 'Perkecil' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Layar Penuh' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize', label: 'Perkecil' },
        { role: 'zoom', label: 'Zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front', label: 'Ke Depan' }
        ] : [
          { role: 'close', label: 'Tutup' }
        ])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ==========================================================================
// SYSTEM TRAY
// ==========================================================================

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'logo.png');
  let trayIcon;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  } catch (e) {
    console.warn('[Electron] Could not load tray icon, skipping tray creation');
    return;
  }

  tray = new Tray(trayIcon);
  tray.setToolTip(APP_NAME);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Buka ${APP_NAME}`,
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Keluar',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

// ==========================================================================
// IPC HANDLERS
// ==========================================================================

function setupIpcHandlers() {
  // Window controls
  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });

  // App version
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Native notifications
  ipcMain.on('show-notification', (event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  // Native file dialog
  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['txt', 'pdf', 'md', 'csv'] }
      ]
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });

  // Native directory dialog
  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });

  // Overlay Window & Screen Capture controls
  ipcMain.on('hide-overlay', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.hide();
    }
  });

  ipcMain.on('toggle-overlay', () => {
    toggleOverlayWindow();
  });

  ipcMain.handle('open-screen-settings', () => {
    const { shell } = require('electron');
    if (process.platform === 'darwin') {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    }
  });

  ipcMain.handle('capture-screen', async () => {
    // Check macOS Screen Recording permission status first
    if (process.platform === 'darwin' && systemPreferences && systemPreferences.getMediaAccessStatus) {
      const status = systemPreferences.getMediaAccessStatus('screen');
      console.log(`[Electron] macOS Screen Recording Permission status: ${status}`);
      if (status === 'denied') {
        const { shell } = require('electron');
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
        return {
          error: 'permission_required',
          message: 'Akses Screen Recording macOS ditolak/belum diizinkan.\n\nSystem Settings -> Privacy & Security -> Screen Recording telah dibuka. Harap beri centang/aktifkan izin untuk "Electron" atau "Terminal", lalu restart aplikasi.'
        };
      }
    }

    // Hide overlay window briefly so it doesn't block/cover the application underneath
    const wasVisible = overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible();
    if (wasVisible) {
      overlayWindow.hide();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    let result = null;
    const mousePoint = screen.getCursorScreenPoint();
    const currentDisplay = screen.getDisplayNearestPoint(mousePoint);
    const allDisplays = screen.getAllDisplays();
    const displayIndex = Math.max(1, allDisplays.findIndex(d => d.id === currentDisplay.id) + 1);

    // 1. Native macOS screencapture CLI targeting the current active display index
    if (process.platform === 'darwin') {
      const fs = require('fs');
      const tmpPath = path.join(app.getPath('temp'), `nextai_snap_${Date.now()}.png`);
      try {
        const { execSync } = require('child_process');
        execSync(`/usr/sbin/screencapture -x -D ${displayIndex} "${tmpPath}"`);
        if (fs.existsSync(tmpPath)) {
          const imgBuffer = fs.readFileSync(tmpPath);
          fs.unlinkSync(tmpPath); // Delete temp file immediately
          if (imgBuffer.length > 1000) {
            console.log(`[Electron] Native macOS screen capture successful for Display #${displayIndex}`);
            result = `data:image/png;base64,${imgBuffer.toString('base64')}`;
          }
        }
      } catch (err) {
        console.warn(`[Electron] Native macOS screencapture for Display #${displayIndex} failed, trying default screencapture...`, err ? err.message : err);
        if (fs.existsSync(tmpPath)) {
          try { fs.unlinkSync(tmpPath); } catch (e) {}
        }
      }

      // Fallback: default screencapture without -D
      if (!result) {
        const tmpPath2 = path.join(app.getPath('temp'), `nextai_snap_fallback_${Date.now()}.png`);
        try {
          const { execSync } = require('child_process');
          execSync(`/usr/sbin/screencapture -x "${tmpPath2}"`);
          if (fs.existsSync(tmpPath2)) {
            const imgBuffer = fs.readFileSync(tmpPath2);
            fs.unlinkSync(tmpPath2);
            if (imgBuffer.length > 1000) {
              result = `data:image/png;base64,${imgBuffer.toString('base64')}`;
            }
          }
        } catch (e) {
          if (fs.existsSync(tmpPath2)) { try { fs.unlinkSync(tmpPath2); } catch (err2) {} }
        }
      }
    }

    // 2. Electron desktopCapturer fallback matching targetDisplay.id
    if (!result) {
      try {
        if (process.platform === 'darwin' && systemPreferences && systemPreferences.getMediaAccessStatus) {
          const status = systemPreferences.getMediaAccessStatus('screen');
          if (status === 'not-determined' && systemPreferences.askForMediaAccess) {
            await systemPreferences.askForMediaAccess('screen');
          }
        }

        const sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 1440, height: 900 }
        });
        if (sources && sources.length > 0) {
          const targetDisplayIdStr = String(currentDisplay.id);
          const screenSource = sources.find(s => s.display_id === targetDisplayIdStr || s.id.includes(targetDisplayIdStr))
            || sources.find(s => s.id.startsWith('screen:') || (!s.name.includes('NextAI') && !s.name.includes('Spotlight')))
            || sources[0];
          result = screenSource.thumbnail.toDataURL();
        }
      } catch (err) {
        console.error('[Electron] Screen capture fallback failed:', err ? err.message : err);
      }
    }

    // Restore overlay window
    if (wasVisible && overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.show();
      overlayWindow.focus();
    }

    return result;
  });

  // Dynamic Global Shortcut Handlers
  ipcMain.handle('get-global-shortcut', () => {
    return currentShortcut;
  });

  ipcMain.handle('set-global-shortcut', (event, newShortcut) => {
    return applyGlobalShortcut(newShortcut);
  });
}

// ==========================================================================
// APP LIFECYCLE
// ==========================================================================

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    console.log(`[Electron] ${APP_NAME} is starting...`);

    // Set dock icon for macOS development mode
    if (process.platform === 'darwin') {
      try {
        app.dock.setIcon(path.join(__dirname, 'assets', 'logo.png'));
      } catch (e) {
        console.warn('[Electron] Could not set dock icon', e);
      }
    }

    // Setup IPC handlers
    setupIpcHandlers();

    // Load & Register Global Hotkey
    loadSavedShortcut();
    applyGlobalShortcut(currentShortcut);

    // Create application menu
    createAppMenu();

    // Start Python TTS server
    try {
      await startPythonServer();
    } catch (err) {
      console.error('[Electron] Python server failed to start:', err.message);
    }

    // Create main window & pre-create overlay window
    createMainWindow();
    createOverlayWindow();

    // Create system tray
    createTray();

    // macOS: re-create window when dock icon clicked
    app.on('activate', () => {
      if (mainWindow === null) {
        createMainWindow();
      } else {
        mainWindow.show();
      }
    });
  });

  // Quit handler
  app.on('before-quit', () => {
    isQuitting = true;
    stopPythonServer();
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    stopPythonServer();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
