// RetroLimpia - proceso principal de Electron
// Abre la ventana, conecta la interfaz con el motor (scripts de PowerShell)
// y guarda los ajustes. No envía ningún dato a internet (sin telemetría).

const { app, BrowserWindow, ipcMain, shell, net, Tray, Menu, Notification, nativeImage } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const engine = require('./engine');
const pkg = require('../package.json');

const DEMO = process.argv.includes('--demo') || process.platform !== 'win32';
const BACKGROUND = process.argv.includes('--background');   // arrancado con Windows: sin ventana
let win = null;
let tray = null;
let quitting = false;
let timers = [];
let checking = false;

// ---------- Ajustes ----------
const settingsFile = () => path.join(app.getPath('userData'), 'ajustes.json');
const defaultSettings = {
  idioma: (app.getLocale() || 'es').toLowerCase().startsWith('es') ? 'es' : 'en',
  modoExperto: false,
  restosAutomaticos: true,
  puntoRestauracion: true,
  confianzaVista: false,
  diasCuarentena: 7,
  inicioWindows: false,
  recordatoriosPreguntado: false,
  frecuenciaDias: 3,
  ultimaRevision: 0,
  procesosAviso: false,
  bandejaAvisada: false
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
const T = (es, en) => (loadSettings().idioma === 'en' ? en : es);

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
    icon: path.join(__dirname, '..', 'renderer', 'icon.png'),
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
  // Con los recordatorios activados, cerrar la ventana deja RetroLimpia en la bandeja
  win.on('close', (e) => {
    const s = loadSettings();
    if (!quitting && s.inicioWindows && tray) {
      e.preventDefault();
      win.hide();
      if (!s.bandejaAvisada) {
        saveSettings({ ...s, bandejaAvisada: true });
        notify(T('RetroLimpia sigue cuidando tu PC', 'RetroLimpia keeps looking after your PC'),
          T('Está en la bandeja (junto al reloj) para avisarte cuando toque limpiar o actualizar. Clic derecho en su icono para salir.', 'It is in the tray (next to the clock) to remind you when to clean or update. Right-click its icon to quit.'));
      }
    }
  });
  win.on('closed', () => { win = null; });
}
function showWindow() {
  if (!win) createWindow();
  else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
}

// ---------- Iniciar con Windows ----------
// Se usa el Programador de tareas (y no la carpeta Inicio) porque RetroLimpia necesita
// permisos de administrador: así arranca sin que Windows pregunte en cada inicio.
const TASK_NAME = 'RetroLimpia (recordatorios)';
function exePath() { return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath; }
function schtasks(args) {
  return new Promise((resolve) => {
    if (DEMO) return resolve(true);
    execFile('schtasks', args, { windowsHide: true }, (err) => resolve(!err));
  });
}
function setAutostart(on) {
  if (!on) return schtasks(['/Delete', '/F', '/TN', TASK_NAME]).then(() => true);
  return schtasks(['/Create', '/F', '/TN', TASK_NAME, '/SC', 'ONLOGON', '/RL', 'HIGHEST', '/DELAY', '0001:00', '/TR', `"${exePath()}" --background`]);
}

// ---------- Bandeja, notificaciones y revisiones automáticas ----------
function notify(title, body, onClick) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: path.join(__dirname, '..', 'renderer', 'icon.png') });
  n.on('click', () => { showWindow(); if (onClick) onClick(); });
  n.show();
}
function createTray() {
  if (tray) return;
  const img = nativeImage.createFromPath(path.join(__dirname, '..', 'renderer', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('RetroLimpia');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: T('Abrir RetroLimpia', 'Open RetroLimpia'), click: showWindow },
    { label: T('Revisar ahora', 'Check now'), click: () => backgroundCheck(true) },
    { type: 'separator' },
    { label: T('Salir', 'Quit'), click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', showWindow);
}
function destroyTray() {
  timers.forEach(clearInterval); timers = [];
  if (tray) { tray.destroy(); tray = null; }
}
function startTimers() {
  if (timers.length) return;
  timers.push(setTimeout(() => backgroundCheck(false), 2 * 60 * 1000));
  timers.push(setInterval(() => backgroundCheck(false), 60 * 60 * 1000));
}
function fmtBytes(b) { return (b / 1024 ** 3 >= 1 ? (b / 1024 ** 3).toFixed(1) + ' GB' : Math.round(b / 1024 ** 2) + ' MB'); }

// Revisión ligera y de solo lectura: basura y actualizaciones. Avisa solo si hay algo que hacer.
async function backgroundCheck(force) {
  const s = loadSettings();
  if (checking) return;
  if (!force && Date.now() - (s.ultimaRevision || 0) < (s.frecuenciaDias || 3) * 864e5) return;
  checking = true;
  try {
    const [junk, upd] = await Promise.all([
      engine.run('limpieza', { accion: 'analizar' }).catch(() => null),
      engine.run('actualizaciones', { accion: 'buscar' }).catch(() => null)
    ]);
    const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
    const basura = arr(junk && junk.categorias).filter((c) => c.color === 'verde').reduce((a, c) => a + (c.tamano || 0), 0);
    const nWin = arr(upd && upd.windows).filter((u) => !u.opcional && !u.grande).length;
    const nApps = arr(upd && upd.apps).length;
    saveSettings({ ...loadSettings(), ultimaRevision: Date.now() });
    const partes = [];
    if (basura > 500 * 1024 ** 2) partes.push(T(`${fmtBytes(basura)} de archivos basura`, `${fmtBytes(basura)} of junk files`));
    if (nWin) partes.push(T(`${nWin} actualización(es) de Windows`, `${nWin} Windows update(s)`));
    if (nApps) partes.push(T(`${nApps} programa(s) por actualizar`, `${nApps} program(s) to update`));
    if (partes.length) {
      notify(T('Tu PC necesita un repaso', 'Your PC needs a tune-up'), partes.join(' · ') + T('. Haz clic para revisarlo.', '. Click to review.'));
    } else if (force) {
      notify(T('Todo en orden', 'All good'), T('No hay basura importante ni actualizaciones pendientes.', 'No significant junk or pending updates.'));
    }
  } finally { checking = false; }
}

// Una sola instancia abierta
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  app.whenReady().then(() => {
    engine.init({ demo: DEMO, scriptsDir: app.isPackaged ? path.join(process.resourcesPath, 'scripts') : path.join(__dirname, '..', 'scripts') });
    if (process.platform === 'win32') app.setAppUserModelId(pkg.build.appId);
    const s = loadSettings();
    if (s.inicioWindows || BACKGROUND) { createTray(); startTimers(); }
    if (!BACKGROUND) createWindow();
    // Mantenimiento silencioso: vacía la cuarentena vieja al arrancar
    engine.run('cuarentena', { accion: 'purgar', dias: s.diasCuarentena }).catch(() => {});
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => { if (!tray) app.quit(); });
}

ipcMain.handle('rl:autostart', async (e, on, dias) => {
  const ok = await setAutostart(!!on);
  const s = saveSettings({ ...loadSettings(), inicioWindows: !!on && ok, recordatoriosPreguntado: true, frecuenciaDias: Number(dias) || loadSettings().frecuenciaDias });
  if (s.inicioWindows) { createTray(); startTimers(); } else destroyTray();
  return { ok, settings: s };
});
ipcMain.handle('rl:checkNow', () => backgroundCheck(true));

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
  paypal: pkg.retrolimpia.paypal || '',
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
