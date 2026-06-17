const { app, BrowserWindow, ipcMain, protocol, net, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

let mainWindow = null;
let activeSkinDir = '';

// Register wmp-skin:// and wmp-media:// protocol handlers
protocol.registerSchemesAsPrivileged([
  { scheme: 'wmp-skin', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: 'wmp-media', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

function handleSkinProtocol() {
  protocol.handle('wmp-skin', async (request) => {
    try {
      const parsedUrl = new URL(request.url);
      const urlPath = decodeURIComponent(parsedUrl.pathname).replace(/^\//, '');
      if (!activeSkinDir) {
        return new Response('No active skin loaded', { status: 400 });
      }
      
      const absolutePath = path.resolve(activeSkinDir, urlPath);
      // Prevent directory traversal attacks
      if (!absolutePath.startsWith(activeSkinDir)) {
        return new Response('Access Denied', { status: 403 });
      }

      if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
        const fileUrl = 'file://' + absolutePath.replace(/\\/g, '/');
        return net.fetch(fileUrl);
      }
      return new Response('File not found: ' + urlPath, { status: 404 });
    } catch (e) {
      console.error('Protocol handler error:', e);
      return new Response('Error loading resource', { status: 500 });
    }
  });

  protocol.handle('wmp-media', async (request) => {
    try {
      const urlPath = decodeURIComponent(request.url.replace('wmp-media://', ''));
      if (fs.existsSync(urlPath) && fs.statSync(urlPath).isFile()) {
        const fileUrl = 'file://' + urlPath.replace(/\\/g, '/');
        return net.fetch(fileUrl);
      }
      return new Response('Media file not found', { status: 404 });
    } catch (e) {
      console.error('Media protocol handler error:', e);
      return new Response('Error loading media resource', { status: 500 });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 520,
    transparent: true,
    frame: false,
    hasShadow: false, // Prevents rectangular shadow outline on custom shapes
    resizable: false, // WMP skins control sizing
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.openDevTools({ mode: 'detach' }); // Enable debugging logs in a separate window

  // Expose right-click context menu
  mainWindow.webContents.on('context-menu', async (event, params) => {
    const skins = await scanSkins();
    const contextTemplate = [
      {
        label: 'Open Audio File...',
        click: async () => {
          const filePath = await selectMediaFileHelper();
          if (filePath) mainWindow.webContents.send('menu-open-media', filePath);
        }
      },
      {
        label: 'Load Skin...',
        click: async () => {
          const filePath = await selectSkinFileHelper();
          if (filePath) mainWindow.webContents.send('menu-load-skin', filePath);
        }
      },
      {
        label: 'Return to Skin Selector',
        click: () => {
          mainWindow.webContents.send('menu-return-dashboard');
        }
      },
      { type: 'separator' },
      {
        label: 'Play',
        click: () => mainWindow.webContents.send('menu-playback', 'play')
      },
      {
        label: 'Pause',
        click: () => mainWindow.webContents.send('menu-playback', 'pause')
      },
      {
        label: 'Stop',
        click: () => mainWindow.webContents.send('menu-playback', 'stop')
      },
      { type: 'separator' },
      {
        label: 'Skins',
        submenu: skins.map(skin => ({
          label: skin.name,
          click: () => mainWindow.webContents.send('menu-load-skin', skin.path)
        }))
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => mainWindow.close()
      }
    ];

    const contextMenu = Menu.buildFromTemplate(contextTemplate);
    contextMenu.popup(mainWindow);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Scans available themes in skins/ folder
async function scanSkins() {
  try {
    const skinsDir = path.join(__dirname, 'skins');
    if (!fs.existsSync(skinsDir)) {
      return [];
    }
    const entries = fs.readdirSync(skinsDir, { withFileTypes: true });
    const skins = [];
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue;
      
      const fullPath = path.join(skinsDir, entry.name);
      if (entry.isDirectory()) {
        skins.push({
          name: entry.name,
          type: 'folder',
          path: fullPath
        });
      } else if (entry.isFile() && (entry.name.endsWith('.wmz') || entry.name.endsWith('.zip'))) {
        skins.push({
          name: entry.name.replace(/\.wmz$|\.zip$/i, ''),
          type: 'archive',
          path: fullPath
        });
      }
    }
    return skins;
  } catch (error) {
    console.error('Error scanning skins:', error);
    return [];
  }
}

// Build standard macOS application top menu bar
async function buildApplicationMenu() {
  const skins = await scanSkins();
  
  const skinsSubmenu = skins.map(skin => ({
    label: skin.name,
    click: () => {
      if (mainWindow) {
        mainWindow.webContents.send('menu-load-skin', skin.path);
      }
    }
  }));

  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Audio File...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const filePath = await selectMediaFileHelper();
            if (filePath && mainWindow) {
              mainWindow.webContents.send('menu-open-media', filePath);
            }
          }
        },
        {
          label: 'Load Skin File...',
          accelerator: 'CmdOrCtrl+S',
          click: async () => {
            const filePath = await selectSkinFileHelper();
            if (filePath && mainWindow) {
              mainWindow.webContents.send('menu-load-skin', filePath);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Return to Skin Selector',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-return-dashboard');
            }
          }
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Skins',
      submenu: skinsSubmenu.length > 0 ? skinsSubmenu : [{ label: 'No skins found', enabled: false }]
    },
    {
      label: 'Controls',
      submenu: [
        {
          label: 'Play',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-playback', 'play');
          }
        },
        {
          label: 'Pause',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-playback', 'pause');
          }
        },
        {
          label: 'Stop',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-playback', 'stop');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  handleSkinProtocol();
  createWindow();
  buildApplicationMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC communication handlers
ipcMain.handle('drag-window', (event, deltaX, deltaY) => {
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
  }
});

ipcMain.handle('resize-window', (event, width, height) => {
  if (mainWindow) {
    mainWindow.setSize(Math.round(width), Math.round(height));
  }
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

async function selectMediaFileHelper() {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Audio File',
    properties: ['openFile'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
}

async function selectSkinFileHelper() {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Windows Media Player Skin',
    properties: ['openFile'],
    filters: [
      { name: 'WMP Skins', extensions: ['wms', 'wmz', 'zip'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
}

ipcMain.handle('select-media-file', async () => {
  return selectMediaFileHelper();
});

ipcMain.handle('load-skin', async (event, skinPathOrZip) => {
  try {
    const isZip = skinPathOrZip.endsWith('.wmz') || skinPathOrZip.endsWith('.zip');
    
    // Create temp directory for extracted skins if needed
    const tempSkinsRoot = path.join(app.getPath('userData'), 'ExtractedSkins');
    if (!fs.existsSync(tempSkinsRoot)) {
      fs.mkdirSync(tempSkinsRoot, { recursive: true });
    }

    if (isZip) {
      const skinName = path.basename(skinPathOrZip, path.extname(skinPathOrZip));
      const targetDir = path.join(tempSkinsRoot, skinName);
      
      // Extract zip
      const zip = new AdmZip(skinPathOrZip);
      zip.extractAllTo(targetDir, true);
      
      activeSkinDir = targetDir;
    } else {
      activeSkinDir = skinPathOrZip;
    }

    // Find the main .wms file in activeSkinDir
    const files = fs.readdirSync(activeSkinDir);
    const wmsFile = files.find(file => file.toLowerCase().endsWith('.wms'));
    if (!wmsFile) {
      throw new Error('No .wms file found in skin directory');
    }

    // Read the wms file content
    const wmsFilePath = path.join(activeSkinDir, wmsFile);
    const wmsBuffer = fs.readFileSync(wmsFilePath);

    // Detect UTF-16 vs UTF-8 by BOM or simple check
    let wmsContent = '';
    if (wmsBuffer[0] === 0xFF && wmsBuffer[1] === 0xFE) {
      wmsContent = wmsBuffer.toString('utf16le');
    } else if (wmsBuffer[0] === 0xFE && wmsBuffer[1] === 0xFF) {
      wmsContent = wmsBuffer.toString('utf16be');
    } else {
      // Check for presence of null bytes which indicates UTF-16
      let isUtf16 = false;
      const scanLimit = Math.min(wmsBuffer.length, 100);
      for (let i = 0; i < scanLimit; i++) {
        if (wmsBuffer[i] === 0) {
          isUtf16 = true;
          break;
        }
      }
      if (isUtf16) {
        wmsContent = wmsBuffer.toString('utf16le');
      } else {
        wmsContent = wmsBuffer.toString('utf8');
      }
    }

    // Refresh application menu because available skins might have changed (e.g. loaded a custom zip skin)
    buildApplicationMenu();

    return {
      success: true,
      wmsContent,
      wmsFileName: wmsFile,
      skinDir: activeSkinDir
    };
  } catch (error) {
    console.error('Failed to load skin:', error);
    return { success: false, error: error.message };
  }
});

// Reads a file from the skin directory (e.g. skin JS script)
ipcMain.handle('read-skin-text-file', async (event, fileName) => {
  try {
    if (!activeSkinDir) throw new Error('No skin loaded');
    const filePath = path.join(activeSkinDir, fileName);
    if (!filePath.startsWith(activeSkinDir)) throw new Error('Forbidden path');
    
    const buffer = fs.readFileSync(filePath);
    // Detect UTF-16
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return buffer.toString('utf16le');
    } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return buffer.toString('utf16be');
    }
    return buffer.toString('utf8');
  } catch (error) {
    console.error(`Error reading ${fileName}:`, error);
    return '';
  }
});

// Scan the workspace skins/ directory for available themes
ipcMain.handle('list-local-skins', async () => {
  return scanSkins();
});

// Open file dialog to choose custom skin files
ipcMain.handle('select-skin-file', async () => {
  return selectSkinFileHelper();
});
