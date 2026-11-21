'use strict';
// ============================================================ Utilidades UI
function toast(msg, type = 'ok') {
  if (type === 'err' && typeof retroReacciona === 'function') retroReacciona('preocupado', null, 3500);
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 5200);
}
function setStatus(t) { $('#titlebarStatus').textContent = t || ''; }

// Tareas: solo una a la vez. Las de solo lectura se cancelan al instante;
// las que cambian el sistema se detienen al terminar el paso en curso (nunca a medias).
async function task(label, fn, opts = {}) {
  if (S.busy) { toast(L('Espera a que termine la tarea actual o cancélala.', 'Wait for the current task to finish or cancel it.'), 'err'); return; }
  S.cancelRequested = false;
  S.busy = { label, pct: 0, msg: '', start: Date.now(), cambios: !!opts.cambios };
  rl.setBusy && rl.setBusy(true);
  setStatus(label); render();
  try { return await fn(); }
  catch (e) {
    if (isCancel(e)) toast(L('Tarea cancelada.', 'Task cancelled.'));
    else { console.error(e); toast(L('Algo falló: ', 'Something failed: ') + cleanErr(e), 'err'); }
  }
  finally { S.busy = null; S.cancelRequested = false; rl.setBusy && rl.setBusy(false); setStatus(''); render(); }
}
const taskC = (label, fn) => task(label, fn, { cambios: true });
const isCancel = (e) => S.cancelRequested || /CANCELADO/.test(String(e && e.message || e));
function checkCancel() { if (S.cancelRequested) throw new Error('CANCELADO'); }
async function cancelTask() {
  if (!S.busy || S.cancelRequested) return;
  S.cancelRequested = true;
  if (!S.busy.cambios) await rl.cancel();   // solo lectura: se corta ya
  else S.busy.msg = L('Cancelando al terminar el paso actual (para no dejar nada a medias)...', 'Cancelling after the current step (so nothing is left half-done)...');
  render();
  if (S.mon && !S.mon.done) renderMonitor();
}
function fmtEta(start, pct) {
  const el = (Date.now() - start) / 1000;
  if (pct < 4 || el < 4) return L('Calculando tiempo...', 'Estimating time...');
  const left = Math.max(1, Math.round(el * (100 - pct) / pct));
  if (left < 60) return L(`Quedan ~${left} s`, `~${left} s left`);
  return L(`Quedan ~${Math.round(left / 60)} min`, `~${Math.round(left / 60)} min left`);
}
function progressHTML() {
  if (!S.busy) return '';
  const pct = Math.min(99, Math.round(S.busy.pct || 0));
  if (!S.busy.ultimo) S.busy.ultimo = Date.now();
  const quieto = Math.round((Date.now() - S.busy.ultimo) / 1000);
  const aviso = quieto >= 60 && !S.cancelRequested ? `<div class="meta" style="margin-top:6px">⏳ ${L(`Sigue trabajando (lleva ${fmtQuieto(quieto)} sin novedades). Algunos pasos de Windows tardan; si crees que se trabó, pulsa Cancelar: no se rompe nada.`, `Still working (${fmtQuieto(quieto)} without news). Some Windows steps are slow; if you think it is stuck, press Cancel: nothing breaks.`)}</div>` : '';
  return `<div class="progress-card"><div class="msg"><span><b>${esc(S.busy.label)}</b>${S.busy.msg ? ' · ' + esc(S.busy.msg) : ''}</span><span class="eta">${pct ? pct + '% · ' + fmtEta(S.busy.start, pct) : ''}</span></div>
  <div class="prow"><div class="pbar ${pct ? '' : 'indet'}"><i style="width:${pct}%"></i></div>
  <button class="btn small danger" data-act="cancel" ${S.cancelRequested ? 'disabled' : ''}>${S.cancelRequested ? L('Cancelando...', 'Cancelling...') : L('Cancelar', 'Cancel')}</button></div>${aviso}</div>`;
}
const fmtQuieto = (s) => s < 120 ? s + ' s' : Math.round(s / 60) + ' min';
function updateProgressOnly() {
  const card = document.querySelector('.progress-card');
  if (card && S.busy) card.outerHTML = progressHTML();
}

// ============================================================ Datos
// PowerShell a veces devuelve un objeto suelto en vez de una lista: lo normalizamos siempre.
const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const obj = (x) => (x && typeof x === 'object' ? x : {});
async function loadPrograms() { const r = obj(await rl.run('programas', {})); S.programs = { programas: arr(r.programas), apps: arr(r.apps) }; S.programsAt = Date.now(); }
// Si se instala o desinstala algo FUERA de RetroLimpia (Steam, Ajustes de Windows...), la lista se
// pone al día sola: al volver a la ventana o al entrar en Programas. Es silencioso: no borra la pantalla.
let refrescandoProgs = false;
async function refreshProgramsQuiet(motivo) {
  if (!S.programs || refrescandoProgs || S.busy || (S.mon && !S.mon.done)) return;
  if (Date.now() - (S.programsAt || 0) < 15000) return;
  refrescandoProgs = true;
  try {
    const antes = new Set(allPrograms().map((p) => p.id));
    const r = obj(await rl.run('programas', {}));
    S.programs = { programas: arr(r.programas), apps: arr(r.apps) }; S.programsAt = Date.now();
    const ahora = new Set(allPrograms().map((p) => p.id));
    [...S.sel].forEach((id) => { if (!ahora.has(id)) S.sel.delete(id); });
    const quitados = [...antes].filter((id) => !ahora.has(id)).length, nuevos = [...ahora].filter((id) => !antes.has(id)).length;
    if (quitados || nuevos) {
      if (S.view === 'programas') render();
      toast(L('Lista de programas al día', 'Program list updated') + (quitados ? L(` · ${quitados} ya no está(n)`, ` · ${quitados} removed`) : '') + (nuevos ? L(` · ${nuevos} nuevo(s)`, ` · ${nuevos} new`) : ''));
    }
  } catch { /* si falla, se intenta la próxima vez */ }
  finally { refrescandoProgs = false; }
}
window.addEventListener('focus', () => refreshProgramsQuiet('foco'));
// Después de cada acción que cambia el PC, se vuelven a leer las pestañas afectadas
// (en segundo plano: no bloquea nada y la pantalla no se queda en blanco).
const REFRESH = {
  programas: ['programs', () => loadPrograms()], inicio: ['startup', () => loadStartup()],
  actualizaciones: ['updates', () => loadUpdates()], drivers: ['drivers', () => loadDrivers()],
  hardware: ['hardware', () => loadHardware()], limpieza: ['junk', () => loadJunk()], cuarentena: ['quarantine', () => loadQuarantine()]
};
const VIEW_REFRESH = { programas: 'programas', arranque: 'inicio', actualizaciones: 'actualizaciones', drivers: 'drivers', hardware: 'hardware', limpieza: 'limpieza', deshacer: 'cuarentena' };
S.refreshing = new Set();
function refreshAfter(...keys) {
  setTimeout(async () => {
    for (const k of keys) {
      const def = REFRESH[k];
      if (!def || S.refreshing.has(k)) continue;
      if (!S[def[0]]) continue;            // aún no se había abierto: se cargará al entrar
      S.refreshing.add(k); if (VIEW_REFRESH[S.view] === k) render();
      try { await def[1](); } catch { /* se reintenta al volver a entrar */ }
      finally { S.refreshing.delete(k); render(); }
    }
  }, 0);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshProgramsQuiet('visible'); });
async function loadHardware() {
  const r = obj(await rl.run('hardware', {}));
  S.hardware = { ...r, equipo: obj(r.equipo), sistema: obj(r.sistema), cpu: obj(r.cpu), ram: obj(r.ram), placa: obj(r.placa), bios: obj(r.bios), gpus: arr(r.gpus), discos: arr(r.discos), unidades: arr(r.unidades), bateria: r.bateria || null };
}
async function loadDrivers() { const r = obj(await rl.run('drivers', { accion: 'revisar' })); S.drivers = { drivers: arr(r.drivers), problemas: arr(r.problemas), respaldos: arr(r.respaldos) }; }
async function loadUpdates() {
  const r = obj(await rl.run('actualizaciones', { accion: 'buscar' }));
  const solos = { ...(S.settings.wgSolos || {}) }, okAntes = S.settings.wgOk || {};
  let cambio = false;
  // Si winget ya dijo "actualizado" a esa misma versión y vuelve a ofrecerla, es que el programa se actualiza solo (p. ej. G HUB)
  for (const a of arr(r.apps)) if (!solos[a.id] && okAntes[a.id] && okAntes[a.id] === a.nueva) { solos[a.id] = a.nombre || a.id; cambio = true; }
  if (cambio) S.settings = await rl.setSettings({ wgSolos: solos });
  const apps = arr(r.apps);
  S.updates = { windows: arr(r.windows), apps: apps.filter((a) => !solos[a.id]), solos: apps.filter((a) => solos[a.id]), wingetDisponible: !!r.wingetDisponible, error: r.error || '' };
}
// Drivers de Windows Update: explica para qué aparato es cada uno
const DRV_CLASE = {
  display: ['🎮', 'Tarjeta gráfica', 'Graphics card'], net: ['📶', 'Red / Wi-Fi', 'Network / Wi-Fi'], media: ['🔊', 'Sonido', 'Audio'],
  audioendpoint: ['🔊', 'Sonido', 'Audio'], bluetooth: ['🔵', 'Bluetooth', 'Bluetooth'], system: ['🧩', 'Chipset / placa base', 'Chipset / motherboard'],
  hidclass: ['🖱️', 'Teclado, ratón o mando', 'Keyboard, mouse or controller'], keyboard: ['⌨️', 'Teclado', 'Keyboard'], mouse: ['🖱️', 'Ratón / touchpad', 'Mouse / touchpad'],
  usb: ['🔌', 'Puertos USB', 'USB ports'], scsiadapter: ['💽', 'Controlador de discos', 'Storage controller'], hdc: ['💽', 'Controlador de discos', 'Storage controller'],
  diskdrive: ['💽', 'Disco', 'Drive'], camera: ['📷', 'Cámara', 'Camera'], image: ['📷', 'Cámara / escáner', 'Camera / scanner'], printer: ['🖨️', 'Impresora', 'Printer'],
  firmware: ['⚙️', 'Firmware (BIOS / UEFI)', 'Firmware (BIOS / UEFI)'], extension: ['🧩', 'Complemento de un driver', 'Driver add-on'], softwarecomponent: ['🧩', 'Componente de software de un driver', 'Driver software component'],
  biometric: ['👆', 'Lector de huella / cara', 'Fingerprint / face reader'], sensor: ['🧭', 'Sensores', 'Sensors'], battery: ['🔋', 'Batería', 'Battery'], monitor: ['🖥️', 'Monitor', 'Monitor'],
  otherhardware: ['🔧', 'Otro aparato', 'Other device'],
  securitydevices: ['🔐', 'Chip de seguridad (TPM)', 'Security chip (TPM)'], ports: ['🔌', 'Puertos', 'Ports'], mtd: ['💾', 'Memoria', 'Memory']
};
function driverQueEs(u) {
  const d = u && u.driver; if (!d) return '';
  const c = DRV_CLASE[String(d.clase || '').toLowerCase()];
  const partes = [];
  partes.push(c ? c[0] + ' ' + L(c[1], c[2]) : (d.clase ? '🧩 ' + d.clase : ''));
  if (d.fabricante) partes.push(d.fabricante);
  const txt = partes.filter(Boolean).join(' · ');
  const para = d.dispositivo || d.modelo;
  return txt + (para ? (txt ? ' · ' : '') + L('para: ', 'for: ') + para : '');
}
// Códigos de winget más comunes, explicados en cristiano
function wingetMotivo(code) {
  const c = (Number(code) >>> 0).toString(16).toUpperCase();
  const M = {
    '8A15002B': ['Windows dice que esta versión nueva no se puede aplicar a la que tienes instalada (pasa con programas que se actualizan solos o que tienen varias versiones). No hace falta hacer nada.', 'Windows says this new version cannot be applied to the one you have (common with self-updating apps or apps with several versions installed). Nothing to do.'],
    '8A150006': ['Su instalador falló. Suele pasar si el programa está abierto: ciérralo y vuelve a intentar.', 'Its installer failed. Usually because the program is open: close it and try again.'],
    '8A150101': ['Está abierto. Ciérralo y vuelve a intentar.', 'It is open. Close it and try again.'],
    '8A150102': ['Hay otra instalación en marcha. Espera a que termine y vuelve a intentar.', 'Another installation is running. Wait for it and try again.'],
    '8A150109': ['Se terminará de actualizar al reiniciar el PC.', 'It will finish updating after restarting the PC.'],
    '8A15010A': ['Pide reiniciar el PC antes de actualizarse.', 'It needs a PC restart before updating.'],
    '8A15010C': ['Se canceló la instalación.', 'The installation was cancelled.'],
    '8A150103': ['Un archivo del programa está en uso. Ciérralo y vuelve a intentar.', 'A program file is in use. Close it and try again.'],
    '8A150104': ['Le falta otro programa que necesita para instalarse.', 'It is missing another program it needs.'],
    '8A150105': ['No hay espacio suficiente en el disco.', 'Not enough disk space.'],
    '8A150106': ['No hay memoria suficiente. Cierra programas y vuelve a intentar.', 'Not enough memory. Close programs and try again.'],
    '8A150107': ['No hay conexión a internet.', 'No internet connection.'],
    '8A15010B': ['El instalador está reiniciando el PC.', 'The installer is restarting the PC.'],
    '8A15010D': ['Ya estaba instalado.', 'It was already installed.'],
    '8A15010E': ['Ya tienes una versión más nueva.', 'You already have a newer version.'],
    '8A15010F': ['Una política de Windows o de tu empresa bloquea esta instalación.', 'A Windows or company policy blocks this installation.'],
    '8A150110': ['Falló al instalar algo que necesita.', 'Failed to install something it needs.'],
    '8A150111': ['El programa está abierto. Ciérralo y vuelve a intentar.', 'The program is open. Close it and try again.'],
    '8A150113': ['Esta versión nueva no es compatible con tu Windows.', 'This new version is not compatible with your Windows.'],
    '8A150114': ['Este programa no se puede actualizar encima: hay que desinstalarlo e instalar la versión nueva desde su web.', 'This program cannot be updated in place: uninstall it and install the new version from its website.']
  };
  return M[c] ? L(...M[c]) : L('El instalador devolvió el código ', 'The installer returned code ') + '0x' + c;
}
// Apunta cada resultado de winget: recuerda lo que se actualiza solo y devuelve el motivo si falló
async function wingetResultados(resultados) {
  const solos = { ...(S.settings.wgSolos || {}) }, okv = { ...(S.settings.wgOk || {}) }, noAplica = { ...(S.settings.wgNoAplica || {}) };
  const fallos = [];
  for (const x of arr(resultados)) {
    const app = (S.updates && [...S.updates.apps, ...(S.updates.solos || [])].find((a) => a.id === x.id)) || { nombre: x.id, nueva: '' };
    if (x.ok) { if (app.nueva) okv[x.id] = app.nueva; continue; }
    // "No aplica" una vez puede ser casualidad (p. ej. .NET); si se repite con la misma versión, ya no se ofrece más
    if (((Number(x.codigo) >>> 0) === 0x8A15002B)) {
      if (app.nueva && noAplica[x.id] === app.nueva) solos[x.id] = app.nombre || x.id;
      else noAplica[x.id] = app.nueva || '?';
    }
    fallos.push({ id: x.id, nombre: app.nombre || x.id, motivo: wingetMotivo(x.codigo), solo: !!solos[x.id], info: (Number(x.codigo) >>> 0) === 0x8A15002B });
  }
  S.settings = await rl.setSettings({ wgSolos: solos, wgOk: okv, wgNoAplica: noAplica });
  if (S.updates) {
    const quitar = (a) => solos[a.id];
    S.updates.solos = [...(S.updates.solos || []), ...S.updates.apps.filter(quitar)];
    S.updates.apps = S.updates.apps.filter((a) => !quitar(a));
  }
  return fallos;
}
function wingetAvisar(fallos) {
  const reales = fallos.filter((f) => !f.solo);
  const solos = fallos.filter((f) => f.solo);
  if (solos.length) toast(L('Se actualizan solos (ya no te los mostraré): ', 'They update themselves (won\'t show them again): ') + solos.map((f) => f.nombre).join(', '));
  for (const f of reales) toast(f.nombre + ': ' + f.motivo, f.info ? undefined : 'err');
}
async function loadJunk() {
  const r = obj(await rl.run('limpieza', { accion: 'analizar' }));
  S.junk = { categorias: arr(r.categorias) };
  S.junkSel = new Set(S.junk.categorias.filter((c) => c.color === 'verde' && c.tamano > 0).map((c) => c.id));
}
async function loadStartup() { const r = obj(await rl.run('inicio', { accion: 'listar' })); S.startup = { elementos: arr(r.elementos) }; }
async function loadQuarantine() {
  const q = obj(await rl.run('cuarentena', { accion: 'listar' }));
  S.quarantine = { lotes: arr(q.lotes).map((l) => ({ ...l, items: arr(l.items) })) };
  const rp = obj(await rl.run('restauracion', { accion: 'listar' }));
  S.restorePoints = { puntos: arr(rp.puntos) };
}

function allPrograms() {
  if (!S.programs) return [];
  return [...S.programs.programas, ...S.programs.apps].map((p) => ({ ...p, cls: classifyProgram(p) }));
}

async function restorePoint(motivo) {
  if (!S.settings.puntoRestauracion) return true;
  S.busy && (S.busy.msg = L('Creando punto de restauración...', 'Creating restore point...'));
  const r = await rl.run('restauracion', { accion: 'crear', motivo });
  if (!r.ok) toast(L('No se pudo crear el punto de restauración (puede que esté desactivado en Windows). Seguimos: todo va a la cuarentena igualmente.', 'Could not create a restore point (it may be disabled). Continuing: everything still goes to quarantine.'), 'err');
  return true;
}

// Intenta arreglar un dispositivo con error (apagar/encender, reinstalar driver, volver a detectar). Devuelve un texto claro.
async function arreglarDispositivo(id) {
  const p = (S.drivers?.problemas || []).find((x) => x.id === id) || { dispositivo: id };
  if (S.busy) { S.busy.msg = p.dispositivo; render(); }
  const r = obj(await rl.run('drivers', { accion: 'reparar', id }));
  const nombre = r.nombre || p.dispositivo;
  if (r.ok) return { ok: true, texto: '✅ ' + nombre + ': ' + L('ya funciona.', 'works now.') };
  if (r.mensaje) return { ok: false, texto: nombre + ': ' + r.mensaje };
  if (r.despues === 14 || r.antes === 14) return { ok: false, texto: nombre + ': ' + L('reinicia el PC para terminar de arreglarlo.', 'restart the PC to finish fixing it.') };
  if (r.critico) return { ok: false, texto: nombre + ': ' + L('por seguridad, este tipo de pieza no se reinstala sola. Instala su driver desde Windows Update (abajo) o desde la web de la marca.', 'for safety, this kind of part is not reinstalled automatically. Install its driver from Windows Update (below) or the brand website.') };
  return { ok: false, texto: nombre + ': ' + L('no se arregló solo. Reinicia el PC; si sigue, desconéctalo y vuelve a conectarlo o instala su driver desde la web de la marca.', 'it did not fix itself. Restart the PC; if it persists, unplug and replug it or install its driver from the brand website.') };
}
