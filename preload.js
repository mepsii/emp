const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadSkin: (skinPathOrZip) => ipcRenderer.invoke('load-skin', skinPathOrZip),
  readSkinTextFile: (fileName) => ipcRenderer.invoke('read-skin-text-file', fileName),
  resizeWindow: (width, height) => ipcRenderer.invoke('resize-window', width, height),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  selectMediaFile: () => ipcRenderer.invoke('select-media-file'),
  listLocalSkins: () => ipcRenderer.invoke('list-local-skins'),
  selectSkinFile: () => ipcRenderer.invoke('select-skin-file'),
  dragWindow: (deltaX, deltaY) => ipcRenderer.invoke('drag-window', deltaX, deltaY),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  onMenuOpenMedia: (callback) => ipcRenderer.on('menu-open-media', (event, filePath) => callback(filePath)),
  onMenuLoadSkin: (callback) => ipcRenderer.on('menu-load-skin', (event, skinPath) => callback(skinPath)),
  onMenuReturnDashboard: (callback) => ipcRenderer.on('menu-return-dashboard', () => callback()),
  onMenuPlayback: (callback) => ipcRenderer.on('menu-playback', (event, action) => callback(action))
});
