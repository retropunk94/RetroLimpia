// Puente seguro entre la interfaz y el proceso principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rl', {
  run: (script, params) => ipcRenderer.invoke('rl:run', script, params),
  cancel: () => ipcRenderer.invoke('rl:cancel'),
  data: (name) => ipcRenderer.invoke('rl:data', name),
  getSettings: () => ipcRenderer.invoke('rl:settings:get'),
  setSettings: (s) => ipcRenderer.invoke('rl:settings:set', s),
  info: () => ipcRenderer.invoke('rl:info'),
  open: (url) => ipcRenderer.invoke('rl:open', url),
  openFolder: (which) => ipcRenderer.invoke('rl:openFolder', which),
  saveReport: (html) => ipcRenderer.invoke('rl:saveReport', html),
  checkUpdate: () => ipcRenderer.invoke('rl:checkUpdate'),
  autostart: (on, dias) => ipcRenderer.invoke('rl:autostart', on, dias),
  checkNow: () => ipcRenderer.invoke('rl:checkNow'),
  updateState: () => ipcRenderer.invoke('rl:updateState'),
  installUpdate: () => ipcRenderer.invoke('rl:installUpdate'),
  onSettings: (cb) => { const fn = (e, st) => cb(st); ipcRenderer.on('rl:settings', fn); return () => ipcRenderer.removeListener('rl:settings', fn); },
  onResumen: (cb) => { const fn = (e, r) => cb(r); ipcRenderer.on('rl:resumen', fn); return () => ipcRenderer.removeListener('rl:resumen', fn); },
  onUpdate: (cb) => { const fn = (e, st) => cb(st); ipcRenderer.on('rl:update', fn); return () => ipcRenderer.removeListener('rl:update', fn); },
  win: (action) => ipcRenderer.send('rl:win', action),
  onProgress: (cb) => {
    const fn = (e, p) => cb(p);
    ipcRenderer.on('rl:progress', fn);
    return () => ipcRenderer.removeListener('rl:progress', fn);
  }
});
