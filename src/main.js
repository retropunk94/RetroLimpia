// RetroLimpia - proceso principal de Electron
// Abre la ventana, conecta la interfaz con el motor (scripts de PowerShell)
// y guarda los ajustes. No envía ningún dato a internet (sin telemetría).

const { app, BrowserWindow, ipcMain, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const engine = require('./engine');
const pkg = require('../package.json');

const DEMO = process.argv.includes('--demo') || process.platform !== 'win32';
let win = null;

// ---------- Ajustes ----------
const settingsFile = () => path.join(app.getPath('userData'), 'ajustes.json');
const defaultSettings = {
  idioma: (app.getLocale() || 'es').toLowerCase().startsWith('es') ? 'es' : 'en',
  modoExperto: false,
  restosAutomaticos: true,
  puntoRestauracion: true,
  confianzaVista: false,
  diasCuarentena: 7
};
function loadSettings() {
  try { return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; }
  catch { return { ...defaultSettings }; }
}
function saveSettings(s) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2), 'utf8');
  return s;
}

// ---------- Datos (listas de bloatware, protegidos, inicio) ----------
function dataDir() {
  return app.isPackaged ? path.join(process.resourcesPath, 'data') : path.join(__dirname, '..', 'data');
}
function loadData(name) {
  const safe = path.basename(name).replace(/[^a-z0-9_-]/gi, '');
  return JSON.parse(fs.readFileSync(path.join(dataDir(), safe + '.json'), 'utf8'));
}

// ---------- Ventana ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    backgroundColor: '#0d0b1a',
    show: false,
    title: 'RetroLimpia',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  // Ningún enlace abre ventanas nuevas dentro de la app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

// Una sola instancia abierta
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    engine.init({ demo: DEMO, scriptsDir: app.isPackaged ? path.join(process.resourcesPath, 'scripts') : path.join(__dirname, '..', 'scripts') });
    createWindow();
    // Mantenimiento silencioso: vacía la cuarentena vieja al arrancar
    const s = loadSettings();
    engine.run('cuarentena', { accion: 'purgar', dias: s.diasCuarentena }).catch(() => {});
  });
  app.on('window-all-closed', () => app.quit());
}

// ---------- Comunicación con la interfaz ----------
ipcMain.handle('rl:run', async (e, script, params) => {
  return engine.run(script, params || {}, (p) => {
    if (!e.sender.isDestroyed()) e.sender.send('rl:progress', { script, ...p });
  });
});
ipcMain.handle('rl:cancel', () => engine.cancelAll());
ipcMain.handle('rl:data', (e, name) => loadData(name));
ipcMain.handle('rl:settings:get', () => loadSettings());
ipcMain.handle('rl:settings:set', (e, s) => saveSettings({ ...loadSettings(), ...s }));
ipcMain.handle('rl:info', async () => ({
  version: pkg.version,
  repo: pkg.retrolimpia.repo,
  demo: DEMO,
  plataforma: process.platform,
  esAdmin: DEMO ? true : await engine.isAdmin(),
  equipo: os.hostname()
}));
ipcMain.handle('rl:open', (e, url) => {
  if (typeof url === 'string' && /^https:\/\//i.test(url)) return shell.openExternal(url);
  return false;
});
ipcMain.handle('rl:openFolder', (e, which) => {
  const base = path.join(process.env.ProgramData || os.tmpdir(), 'RetroLimpia');
  const map = { cuarentena: 'Cuarentena', drivers: 'RespaldoDrivers', informes: 'Informes', logs: 'logs' };
  const p = path.join(base, map[which] || '');
  fs.mkdirSync(p, { recursive: true });
  return shell.openPath(p);
});
ipcMain.handle('rl:saveReport', async (e, html) => {
  const dir = path.join(app.getPath('documents'), 'RetroLimpia');
  fs.mkdirSync(dir, { recursive: true });
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  const file = path.join(dir, `Informe-${stamp}.html`);
  fs.writeFileSync(file, html, 'utf8');
  shell.openPath(file);
  return file;
});
ipcMain.handle('rl:checkUpdate', async () => {
  // Solo consulta la última versión publicada en GitHub. No envía datos del PC.
  const repo = pkg.retrolimpia.repo;
  if (!repo || repo.startsWith('TU_USUARIO')) return { disponible: false };
  try {
    const r = await net.fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { 'User-Agent': 'RetroLimpia' } });
    if (!r.ok) return { disponible: false };
    const j = await r.json();
    const ultima = String(j.tag_name || '').replace(/^v/i, '');
    return { disponible: newer(ultima, pkg.version), version: ultima, url: j.html_url };
  } catch { return { disponible: false }; }
});
function newer(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
  return false;
}
ipcMain.on('rl:win', (e, action) => {
  if (!win) return;
  if (action === 'min') win.minimize();
  else if (action === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === 'close') win.close();
});
