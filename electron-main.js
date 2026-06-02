// ==========================================================================
// ELECTRON MAIN PROCESS — NextAI Desktop App
// ==========================================================================
const { app, BrowserWindow, ipcMain, Notification, Menu, Tray, nativeImage, dialog } = require('electron');
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

    // Create application menu
    createAppMenu();

    // Start Python TTS server
    try {
      await startPythonServer();
    } catch (err) {
      console.error('[Electron] Python server failed to start:', err.message);
      // Continue anyway — user can still use cloud APIs and browser TTS
    }

    // Create main window
    createMainWindow();

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
    stopPythonServer();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
