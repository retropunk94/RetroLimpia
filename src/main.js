// RetroLimpia - proceso principal de Electron
// Abre la ventana, conecta la interfaz con el motor (scripts de PowerShell)
// y guarda los ajustes. No envía ningún dato a internet (sin telemetría).

const { app, BrowserWindow, ipcMain, shell, net, Tray, Menu, Notification, nativeImage } = require('electron');
const { execFile, spawn } = require('child_process');
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
let installing = false;   // instalando una actualización: no relanzar nada mientras tanto
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
  bandejaAvisada: false,
  notificaciones: true,
  tourVisto: false,
  ultimoResumen: '',
  relanzarEnBandeja: false,
  ultimaVersion: ''
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
  // Red de seguridad: si Windows no avisa de que la ventana está lista, se muestra igual
  setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible() && !BACKGROUND_HIDDEN()) win.show(); }, 3000);
  win.webContents.on('render-process-gone', () => { if (win && !win.isDestroyed()) win.reload(); });
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
      setTimeout(installWhenIdle, 5000);
      if (!s.bandejaAvisada) {
        saveSettings({ ...s, bandejaAvisada: true });
        // este aviso es solo una vez y explica dónde quedó el programa: se muestra siempre
        notify(T('RetroLimpia sigue cuidando tu PC', 'RetroLimpia keeps looking after your PC'),
          T('Está en la bandeja (junto al reloj) para avisarte cuando toque limpiar o actualizar. Clic derecho en su icono para salir.', 'It is in the tray (next to the clock) to remind you when to clean or update. Right-click its icon to quit.'), null, true);
      }
    }
  });
  win.on('closed', () => { win = null; });
}
let wantHidden = false;
function BACKGROUND_HIDDEN() { return wantHidden; }
function showWindow() {
  wantHidden = false;
  if (!win) createWindow();
  else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
}

// ---------- Iniciar con Windows ----------
// Se usa el Programador de tareas (y no la carpeta Inicio) porque RetroLimpia necesita
// permisos de administrador: así arranca sin que Windows pregunte en cada inicio.
const TASK_NAME = 'RetroLimpia (recordatorios)';
function exePath() { return process.execPath; }
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
// Respeta el ajuste "Notificaciones". Solo lo que pide el usuario a mano (force) se muestra siempre.
function notify(title, body, onClick, force = false) {
  if (!Notification.isSupported()) return;
  if (!force && loadSettings().notificaciones === false) return;
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
    { label: T('Notificaciones', 'Notifications'), type: 'checkbox', checked: loadSettings().notificaciones !== false, click: (m) => { saveSettings({ ...loadSettings(), notificaciones: m.checked }); if (win && !win.isDestroyed()) win.webContents.send('rl:settings', loadSettings()); } },
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

    const partes = [];
    if (basura > 500 * 1024 ** 2) partes.push(T(`${fmtBytes(basura)} de archivos basura`, `${fmtBytes(basura)} of junk files`));
    if (nWin) partes.push(T(`${nWin} actualización(es) de Windows`, `${nWin} Windows update(s)`));
    if (nApps) partes.push(T(`${nApps} programa(s) por actualizar`, `${nApps} program(s) to update`));
    const resumen = partes.length ? partes.join(' · ') : T('Todo en orden', 'All good');
    saveSettings({ ...loadSettings(), ultimaRevision: Date.now(), ultimoResumen: resumen });
    // Aviso silencioso siempre disponible: pasando el ratón por el icono de la bandeja
    if (tray) tray.setToolTip(('RetroLimpia · ' + resumen).slice(0, 127));
    if (win && !win.isDestroyed()) win.webContents.send('rl:resumen', resumen);
    if (partes.length) {
      notify(T('Tu PC necesita un repaso', 'Your PC needs a tune-up'), resumen + T('. Haz clic para revisarlo.', '. Click to review.'), null, force);
    } else if (force) {
      notify(T('Todo en orden', 'All good'), T('No hay basura importante ni actualizaciones pendientes.', 'No significant junk or pending updates.'), null, true);
    }
    return resumen;
  } finally { checking = false; }
}

// Una sola instancia abierta
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Doble clic con RetroLimpia ya abierto (o en la bandeja): se muestra la ventana.
  // Se espera a "ready" por si el primer arranque aún no terminó de cargar.
  app.on('second-instance', () => {
    app.whenReady().then(() => {
      if (installing) return;                       // se está actualizando: volverá a abrirse solo
      if (quitting) { app.relaunch(); return; }     // se estaba cerrando: vuelve a abrirse al salir
      showWindow();
    });
  });
  app.whenReady().then(() => {
    // Cada paso va protegido: si uno falla, la ventana y el actualizador arrancan igual.
    // (Antes, un fallo aquí dejaba el programa abierto pero sin ventana y sin actualizarse.)
    const paso = (nombre, fn) => { try { return fn(); } catch (e) { updLog('Arranque, fallo en ' + nombre + ': ' + (e && e.stack || e)); } };
    paso('motor', () => engine.init({ demo: DEMO, scriptsDir: app.isPackaged ? path.join(process.resourcesPath, 'scripts') : path.join(__dirname, '..', 'scripts') }));
    // OJO: el instalador quita la sección "build" de package.json, así que el id va escrito aquí
    paso('appId', () => { if (process.platform === 'win32') app.setAppUserModelId('com.retropunk94.retrolimpia'); });
    let s = paso('ajustes', () => loadSettings()) || { ...defaultSettings };
    // relanzarEnBandeja guarda la hora: solo vale justo después de una actualización
    const recien = typeof s.relanzarEnBandeja === 'number' && Date.now() - s.relanzarEnBandeja < 10 * 60 * 1000;
    const enBandeja = BACKGROUND || recien;
    if (s.relanzarEnBandeja) s = paso('ajustes2', () => saveSettings({ ...s, relanzarEnBandeja: false })) || s;
    if (s.inicioWindows || enBandeja) paso('bandeja', () => { createTray(); startTimers(); });
    if (!enBandeja) paso('ventana', () => createWindow());
    paso('actualizador', () => initUpdater());
    // Mantenimiento silencioso: vacía la cuarentena vieja al arrancar
    paso('cuarentena', () => engine.run('cuarentena', { accion: 'purgar', dias: s.diasCuarentena }).catch(() => {}));
  }).catch((e) => { updLog('Arranque: ' + (e && e.stack || e)); try { if (!win) createWindow(); } catch {} });
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
ipcMain.handle('rl:reveal', (e, ruta) => {
  // Muestra en el Explorador una carpeta o archivo (solo rutas que existen)
  if (typeof ruta !== 'string' || !/^[a-z]:\\/i.test(ruta)) return false;
  if (!fs.existsSync(ruta)) return false;
  shell.showItemInFolder(ruta);
  return true;
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
// ---------- Actualizaciones de RetroLimpia ----------
// Todo automático, sin pasos para el usuario: electron-updater descarga solo lo que
// cambió y lo instala en silencio.
// Si la ventana está abierta, la interfaz muestra una cuenta atrás (con "Más tarde").
// Si está en la bandeja o cerrada, se instala sola en cuanto no haya ninguna tarea en marcha.
let autoUpdater = null;
let updateState = { estado: 'nada' };
let rendererBusy = false;
function sendUpdate(st) {
  updateState = { ...updateState, ...st };
  if (win && !win.isDestroyed()) win.webContents.send('rl:update', updateState);
}
ipcMain.on('rl:busy', (e, busy) => { rendererBusy = !!busy; });

// Cuando la actualización está lista y nadie está mirando, se instala sola
function installWhenIdle() {
  if (updateState.estado !== 'lista') return;
  const visible = win && !win.isDestroyed() && win.isVisible();
  if (visible) return;               // con ventana abierta decide la cuenta atrás de la interfaz
  if (rendererBusy) return setTimeout(installWhenIdle, 30 * 1000);
  saveSettings({ ...loadSettings(), relanzarEnBandeja: tray ? Date.now() : false });
  doInstall();
}
function doInstall() {
  // Plan B: instalador descargado por nosotros
  if (fallbackFile && fs.existsSync(fallbackFile)) {
    quitting = true; installing = true;
    updLog('Instalando (plan B) ' + fallbackFile);
    try {
      relaunchHelper(4);
      // /S = silencioso; --updated = es una actualización (conserva accesos directos)
      spawn(fallbackFile, ['/S', '--updated'], { detached: true, stdio: 'ignore' }).unref();
      setTimeout(() => app.exit(0), 500);
      return true;
    } catch (e) { updLog('No se pudo lanzar el instalador: ' + e); quitting = false; installing = false; return false; }
  }
  if (!autoUpdater) return false;
  quitting = true; installing = true;
  if (app.isPackaged && process.platform === 'win32') {
    try {
      relaunchHelper(2);
      autoUpdater.quitAndInstall(true, false);   // silencioso; el ayudante lo vuelve a abrir
      return true;
    } catch (e) { updLog('quitAndInstall: ' + e); }
  }
  autoUpdater.quitAndInstall(true, true);   // silencioso y vuelve a abrirse
  return true;
}

// Registro del actualizador: si algo falla queda escrito en %APPDATA%\RetroLimpia\actualizador.log
function updLog(msg) {
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'actualizador.log'), `[${new Date().toISOString()}] v${pkg.version} ${msg}\n`); } catch {}
}
let updaterTries = 0;
function initUpdater() {
  if (DEMO || !app.isPackaged) return;
  try { ({ autoUpdater } = require('electron-updater')); }
  catch (e) {
    autoUpdater = null;
    updLog('No se pudo cargar electron-updater: ' + (e && e.stack || e));
    // Nunca se deja al usuario sin actualizaciones: plan B propio y nuevo intento más tarde
    if (++updaterTries < 3) setTimeout(initUpdater, 60 * 1000);
    setTimeout(() => fallbackCheck().catch((er) => updLog('Plan B: ' + er)), 8000);
    return;
  }
  autoUpdater.logger = { info: () => {}, debug: () => {}, warn: (m) => updLog('aviso: ' + m), error: (m) => updLog('error: ' + m) };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;   // instalar al cerrar dejaba el programa "sin abrir" un rato: se instala con su ventana
  autoUpdater.on('checking-for-update', () => { if (updateState.estado !== 'lista') sendUpdate({ estado: 'buscando' }); });
  autoUpdater.on('update-not-available', () => sendUpdate({ estado: 'al-dia', revisado: Date.now() }));
  autoUpdater.on('update-available', (i) => sendUpdate({ estado: 'descargando', version: i.version, pct: 0 }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ estado: 'descargando', pct: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', (i) => { sendUpdate({ estado: 'lista', version: i.version }); installWhenIdle(); });
  autoUpdater.on('error', (e) => {
    updLog('error del actualizador: ' + (e && e.message || e));
    if (updateState.estado !== 'lista') sendUpdate({ estado: 'error', mensaje: String(e && e.message || e).slice(0, 200) });
    // Si el actualizador oficial falla, se intenta con el plan B (misma descarga, comprobada igual)
    if (updateState.estado !== 'lista' && updateState.estado !== 'descargando') setTimeout(() => fallbackCheck().catch((er) => updLog('Plan B: ' + er)), 5000);
  });
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
}

// ---------- Plan B: actualizar sin electron-updater ----------
// Descarga el instalador de la última versión desde GitHub, comprueba su huella SHA-512
// (la misma que publica latest.yml) y lo deja listo para instalarse en silencio.
let fallbackFile = null;
let fallbackBusy = false;
async function fallbackCheck() {
  if (!app.isPackaged || DEMO || fallbackBusy || updateState.estado === 'lista') return false;
  fallbackBusy = true;
  try {
    const j = await latestRelease();
    const v = String(j.tag_name || '').replace(/^v/i, '');
    if (!newer(v, pkg.version)) { sendUpdate({ estado: 'al-dia', revisado: Date.now() }); return false; }
    const assets = j.assets || [];
    const exe = assets.find((a) => /^RetroLimpia-Instalador-.*\.exe$/i.test(a.name));
    const yml = assets.find((a) => a.name === 'latest.yml');
    if (!exe || !yml) throw new Error('la versión ' + v + ' aún no tiene sus archivos');
    const ymlTxt = await (await net.fetch(yml.browser_download_url)).text();
    const m = ymlTxt.match(/^sha512:\s*(\S+)/m);
    if (!m) throw new Error('latest.yml sin huella');
    sendUpdate({ estado: 'descargando', version: v, pct: 0 });
    const r = await net.fetch(exe.browser_download_url);
    if (!r.ok) throw new Error('descarga ' + r.status);
    const total = Number(r.headers.get('content-length')) || exe.size || 0;
    const file = path.join(os.tmpdir(), exe.name);
    const hash = require('crypto').createHash('sha512');
    const out = fs.createWriteStream(file);
    const reader = r.body.getReader();
    let got = 0, lastPct = -1;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const b = Buffer.from(value);
      hash.update(b); got += b.length;
      if (!out.write(b)) await new Promise((res) => out.once('drain', res));
      const pct = total ? Math.floor((got / total) * 100) : 0;
      if (pct !== lastPct) { lastPct = pct; sendUpdate({ estado: 'descargando', version: v, pct }); }
    }
    await new Promise((res, rej) => out.end((e) => (e ? rej(e) : res())));
    if (hash.digest('base64') !== m[1]) { try { fs.unlinkSync(file); } catch {} throw new Error('la huella no coincide: descarga descartada'); }
    fallbackFile = file;
    updLog('Plan B listo: ' + file);
    sendUpdate({ estado: 'lista', version: v });
    installWhenIdle();
    return true;
  } catch (e) {
    updLog('Plan B falló: ' + (e && e.message || e));
    if (updateState.estado !== 'lista') sendUpdate({ estado: 'error', mensaje: String(e && e.message || e).slice(0, 200) });
    return false;
  } finally { fallbackBusy = false; }
}
function relaunchHelper(extraWait) {
  // Ayudante oculto (con permisos de administrador, como RetroLimpia) que espera a que termine
  // el instalador y vuelve a abrir el programa. Así no queda escondido el aviso de Windows.
  const exe = process.execPath.replace(/'/g, "''");
  const ps = `$ErrorActionPreference='SilentlyContinue'; Wait-Process -Id ${process.pid} -Timeout 60; Start-Sleep -Seconds ${extraWait || 2}; ` +
    `$t=[Diagnostics.Stopwatch]::StartNew(); while ($t.Elapsed.TotalSeconds -lt 300 -and (Get-Process | Where-Object { $_.ProcessName -like 'RetroLimpia-Instalador*' -or $_.ProcessName -like 'installer' -or $_.ProcessName -like 'Un_A*' })) { Start-Sleep -Seconds 1 }; ` +
    `Start-Sleep -Seconds 1; if (-not (Get-Process -Name 'RetroLimpia' -ErrorAction SilentlyContinue)) { Start-Process -FilePath '${exe}' }`;
  spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', ps], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

async function latestRelease() {
  const r = await net.fetch(`https://api.github.com/repos/${pkg.retrolimpia.repo}/releases/latest`, { headers: { 'User-Agent': 'RetroLimpia' } });
  if (!r.ok) throw new Error('GitHub ' + r.status);
  return r.json();
}
async function checkManually() {
  if (autoUpdater) {
    try {
      const r = await autoUpdater.checkForUpdates();
      const v = r && r.updateInfo && r.updateInfo.version;
      return { modo: 'auto', disponible: !!(v && newer(v, pkg.version)), version: v, estado: updateState.estado };
    } catch (e) { return { modo: 'auto', disponible: false, error: String(e.message || e) }; }
  }
  // Versión instalada sin actualizador oficial: plan B (descarga e instala sola)
  if (app.isPackaged && !DEMO) {
    if (updateState.estado === 'lista' || updateState.estado === 'descargando') return { modo: 'auto', disponible: true, version: updateState.version, estado: updateState.estado };
    try {
      const j = await latestRelease();
      const ultima = String(j.tag_name || '').replace(/^v/i, '');
      const hay = newer(ultima, pkg.version);
      if (hay) fallbackCheck().catch(() => {});
      return { modo: 'auto', disponible: hay, version: ultima };
    } catch { return { modo: 'auto', disponible: false, error: 'sin conexión' }; }
  }
  // Modo desarrollo: solo consultar la última versión publicada
  try {
    const j = await latestRelease();
    const ultima = String(j.tag_name || '').replace(/^v/i, '');
    return { modo: 'manual', disponible: newer(ultima, pkg.version), version: ultima, url: j.html_url };
  } catch { return { modo: 'manual', disponible: false, error: 'sin conexión' }; }
}
ipcMain.handle('rl:checkUpdate', () => checkManually());
// "auto" = la versión instalada se actualiza sola (con el actualizador oficial o con el plan B)
ipcMain.handle('rl:updateState', () => ({ ...updateState, auto: !!autoUpdater || (app.isPackaged && !DEMO) }));
ipcMain.handle('rl:installUpdate', () => {
  if (updateState.estado !== 'lista') return false;
  saveSettings({ ...loadSettings(), relanzarEnBandeja: false });
  return doInstall();
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
