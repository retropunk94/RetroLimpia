/* RetroLimpia - lógica de la interfaz.
   Todo ocurre en una sola ventana: no hay ventanas emergentes salvo la
   explicación de confianza la primera vez que se abre. */
'use strict';

// ============================================================ Estado
const S = {
  settings: {}, info: {}, data: {},
  programs: null, hardware: null, drivers: null, updates: null, junk: null, startup: null, quarantine: null, restorePoints: null,
  scan: { state: 'idle', steps: {}, findings: [], score: null, date: null },
  fix: null,
  view: 'inicio',
  busy: null,            // { label, pct, msg }
  sel: new Set(),        // selección en Programas
  progFilter: 'todos', search: '',
  junkSel: null,
  pendingResidues: null, // restos dudosos esperando revisión
  needsReboot: false,
  appUpdate: null
};

const repoUrl = () => (S.info.repo && !S.info.repo.startsWith('TU_USUARIO') ? 'https://github.com/' + S.info.repo : null);
const GH_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';
const L = (es, en) => (S.settings.idioma === 'en' ? (en ?? es) : es);
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GB = 1024 ** 3;

function fmtBytes(b) {
  b = Number(b) || 0;
  if (b < 1024) return b + ' B';
  const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return (b >= 100 ? b.toFixed(0) : b.toFixed(1)).replace('.', S.settings.idioma === 'en' ? '.' : ',') + ' ' + u[i];
}
function globRe(p) { return new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'); }
function yearsSince(dateStr) { if (!dateStr) return null; const d = new Date(dateStr); if (isNaN(d)) return null; return (Date.now() - d.getTime()) / (365.25 * 864e5); }
function prettyAppx(n) {
  let s = n.includes('.') ? n.split('.').slice(1).join(' ') : n;
  return s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim() || n;
}

// ============================================================ Clasificación
function classifyProgram(p) {
  const lists = p.tipo === 'appx' ? S.data.bloat.appx : S.data.bloat.win32;
  for (const r of lists) {
    if (globRe(r.patron).test(p.nombre)) return { color: r.color, nombre: p.tipo === 'appx' ? r.nombre : p.nombre, nota: L(r.es, r.en) };
  }
  if (p.tipo === 'win32') {
    for (const r of S.data.prot.win32) if (globRe(r.patron).test(p.nombre)) return { color: 'rojo', nombre: p.nombre, nota: L(r.es, r.en) };
    return { color: null, nombre: p.nombre, nota: '' };
  }
  return { color: null, nombre: prettyAppx(p.nombre), nota: '' };
}
function classifyStartup(it) {
  const hay = it.nombre + ' ' + it.comando;
  for (const r of S.data.inicio.reglas) {
    const re = globRe(r.patron);
    if (re.test(it.nombre) || re.test(hay)) return { rec: r.rec, nota: L(r.es, r.en) };
  }
  return { rec: 'desconocido', nota: L('No lo conocemos: decide tú. Si no sabes qué es, déjalo como está.', "We don't know it: your call. If unsure, leave it as it is.") };
}
const REC = {
  desactivar: { c: 'verde', es: 'Se puede desactivar', en: 'Safe to disable' },
  opcional: { c: 'amarillo', es: 'Opcional', en: 'Optional' },
  mantener: { c: 'rojo', es: 'Mejor dejarlo', en: 'Better keep it' },
  desconocido: { c: 'gris', es: 'Desconocido', en: 'Unknown' }
};
const COLOR_TXT = {
  verde: ['Seguro quitarlo', 'Safe to remove'],
  amarillo: ['Opcional', 'Optional'],
  rojo: ['Mejor no tocar', 'Better not touch']
};
const JUNK = {
  temp_usuario: ['Archivos temporales', 'Temporary files', 'Restos que dejan los programas al trabajar.', 'Leftovers programs create while working.'],
  temp_windows: ['Temporales de Windows', 'Windows temp files', 'Archivos temporales del propio Windows.', "Windows' own temporary files."],
  wu_cache: ['Descargas de Windows Update', 'Windows Update downloads', 'Instaladores de actualizaciones que ya se aplicaron.', 'Installers of updates already applied.'],
  entrega: ['Caché de optimización de entrega', 'Delivery Optimization cache', 'Copias de actualizaciones para compartir con otros PCs.', 'Update copies shared with other PCs.'],
  informes: ['Informes de errores', 'Error reports', 'Registros de fallos que Windows guarda.', 'Crash logs Windows keeps.'],
  miniaturas: ['Miniaturas de imágenes', 'Thumbnail cache', 'Se vuelven a crear solas al abrir carpetas.', 'Rebuilt automatically when you open folders.'],
  navegadores: ['Caché de navegadores', 'Browser cache', 'Solo la caché: no borra contraseñas, historial ni sesiones. Las páginas tardarán un poco más la primera vez.', 'Cache only: passwords, history and sessions stay. Pages load a bit slower the first time.'],
  volcados: ['Volcados de memoria', 'Memory dumps', 'Archivos de pantallazos azules antiguos. Solo los usan técnicos.', 'Old blue-screen dumps. Only technicians use them.'],
  papelera: ['Papelera de reciclaje', 'Recycle Bin', 'Vacía la papelera. Revísala antes si tiene algo importante.', 'Empties the Recycle Bin. Check it first if it holds anything important.']
};
const PNP_CODES = {
  1: ['Está mal configurado.', 'Not configured correctly.'], 3: ['Su driver está dañado.', 'Its driver is corrupted.'],
  10: ['No puede arrancar.', 'Cannot start.'], 12: ['Le faltan recursos libres.', 'Not enough free resources.'],
  14: ['Necesita reiniciar el PC.', 'Needs a restart.'], 18: ['Hay que reinstalar su driver.', 'Its driver must be reinstalled.'],
  19: ['Su configuración en el registro está dañada.', 'Its registry configuration is damaged.'],
  24: ['No está presente o no funciona.', 'Not present or not working.'], 28: ['No tiene driver instalado.', 'Has no driver installed.'],
  29: ['Está desactivado en la BIOS.', 'Disabled in BIOS.'], 31: ['No funciona correctamente.', 'Not working properly.'],
  32: ['Su servicio está desactivado.', 'Its service is disabled.'], 37: ['Su driver falló al arrancar.', 'Its driver failed to start.'],
  39: ['Su driver falta o está dañado.', 'Driver missing or corrupted.'], 43: ['Windows lo detuvo porque reportó fallos.', 'Windows stopped it because it reported problems.'],
  52: ['Windows no pudo verificar la firma de su driver.', 'Windows could not verify its driver signature.']
};
const GPU_LINKS = {
  nvidia: ['NVIDIA App', 'https://www.nvidia.com/es-la/software/nvidia-app/'],
  amd: ['AMD Software: Adrenalin', 'https://www.amd.com/es/support/download/drivers.html'],
  intel: ['Intel Driver & Support Assistant', 'https://www.intel.com/content/www/us/en/support/detect.html']
};

// ============================================================ Utilidades UI
function toast(msg, type = 'ok') {
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
  setStatus(label); render();
  try { return await fn(); }
  catch (e) {
    if (isCancel(e)) toast(L('Tarea cancelada.', 'Task cancelled.'));
    else { console.error(e); toast(L('Algo falló: ', 'Something failed: ') + (e.message || e), 'err'); }
  }
  finally { S.busy = null; S.cancelRequested = false; setStatus(''); render(); }
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
  return `<div class="progress-card"><div class="msg"><span><b>${esc(S.busy.label)}</b>${S.busy.msg ? ' · ' + esc(S.busy.msg) : ''}</span><span class="eta">${pct ? pct + '% · ' + fmtEta(S.busy.start, pct) : ''}</span></div>
  <div class="prow"><div class="pbar ${pct ? '' : 'indet'}"><i style="width:${pct}%"></i></div>
  <button class="btn small danger" data-act="cancel" ${S.cancelRequested ? 'disabled' : ''}>${S.cancelRequested ? L('Cancelando...', 'Cancelling...') : L('Cancelar', 'Cancel')}</button></div></div>`;
}
function updateProgressOnly() {
  const card = document.querySelector('.progress-card');
  if (card && S.busy) card.outerHTML = progressHTML();
}

// ============================================================ Datos
// PowerShell a veces devuelve un objeto suelto en vez de una lista: lo normalizamos siempre.
const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const obj = (x) => (x && typeof x === 'object' ? x : {});
async function loadPrograms() { const r = obj(await rl.run('programas', {})); S.programs = { programas: arr(r.programas), apps: arr(r.apps) }; }
async function loadHardware() {
  const r = obj(await rl.run('hardware', {}));
  S.hardware = { ...r, equipo: obj(r.equipo), sistema: obj(r.sistema), cpu: obj(r.cpu), ram: obj(r.ram), placa: obj(r.placa), bios: obj(r.bios), gpus: arr(r.gpus), discos: arr(r.discos), unidades: arr(r.unidades), bateria: r.bateria || null };
}
async function loadDrivers() { const r = obj(await rl.run('drivers', { accion: 'revisar' })); S.drivers = { drivers: arr(r.drivers), problemas: arr(r.problemas), respaldos: arr(r.respaldos) }; }
async function loadUpdates() { const r = obj(await rl.run('actualizaciones', { accion: 'buscar' })); S.updates = { windows: arr(r.windows), apps: arr(r.apps), wingetDisponible: !!r.wingetDisponible, error: r.error || '' }; }
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

// ============================================================ Consejos y nota de salud
function hardwareAdvice(hw) {
  const out = [];
  if (!hw) return out;
  const add = (nivel, es, en) => out.push({ nivel, t: L(es, en) });
  for (const d of hw.discos || []) {
    if (d.salud && d.salud !== 'Healthy') add('importante', `El disco "${d.nombre}" muestra señales de fallo. Haz una copia de tus archivos importantes cuanto antes y piensa en cambiarlo.`, `Disk "${d.nombre}" shows signs of failure. Back up your important files as soon as possible and consider replacing it.`);
    if (d.desgaste != null && d.desgaste >= 80) add('importante', `El SSD "${d.nombre}" está gastado al ${d.desgaste}%. Planea reemplazarlo pronto.`, `SSD "${d.nombre}" is ${d.desgaste}% worn. Plan to replace it soon.`);
    else if (d.desgaste != null && d.desgaste >= 50) add('recomendado', `El SSD "${d.nombre}" lleva un ${d.desgaste}% de desgaste. Todavía va bien, pero conviene tener copias.`, `SSD "${d.nombre}" is ${d.desgaste}% worn. Still fine, but keep backups.`);
    if (d.temperatura && d.temperatura >= 65) add('recomendado', `El disco "${d.nombre}" está a ${d.temperatura} °C. Revisa que le llegue aire.`, `Disk "${d.nombre}" is at ${d.temperatura} °C. Check its airflow.`);
  }
  for (const v of hw.unidades || []) {
    const pct = v.total ? v.libre / v.total : 1;
    if (pct < 0.1) add('importante', `A la unidad ${v.letra} solo le queda ${fmtBytes(v.libre)} libre (${Math.round(pct * 100)}%). Windows se vuelve lento con menos de un 10%.`, `Drive ${v.letra} has only ${fmtBytes(v.libre)} free (${Math.round(pct * 100)}%). Windows slows down below 10%.`);
    else if (pct < 0.2) add('recomendado', `A la unidad ${v.letra} le queda poco espacio (${fmtBytes(v.libre)}).`, `Drive ${v.letra} is getting full (${fmtBytes(v.libre)} free).`);
  }
  const s = hw.sistema || {};
  if (s.build && s.build < 22000) add('importante', 'Usas Windows 10, que ya no recibe actualizaciones de seguridad gratuitas desde octubre de 2025. Si tu PC lo permite, pasa a Windows 11.', 'You are on Windows 10, which stopped getting free security updates in October 2025. Upgrade to Windows 11 if your PC supports it.');
  if (s.diasEncendido >= 7) add('opcional', `Tu PC lleva ${Math.round(s.diasEncendido)} días sin reiniciarse. Reiniciar de vez en cuando aplica actualizaciones y libera memoria.`, `Your PC hasn't restarted in ${Math.round(s.diasEncendido)} days. Restarting now and then applies updates and frees memory.`);
  const ram = hw.ram || {};
  if (ram.total && ram.total < 7.5 * GB) add('recomendado', `Tienes ${fmtBytes(ram.total)} de RAM. Para usar Windows 11 con fluidez se recomiendan 16 GB.`, `You have ${fmtBytes(ram.total)} of RAM. 16 GB is recommended for a smooth Windows 11.`);
  for (const g of hw.gpus || []) {
    if (g.temp && g.temp >= 85) add('importante', `La gráfica está a ${g.temp} °C. Limpia el polvo de los ventiladores.`, `The GPU is at ${g.temp} °C. Clean the dust from its fans.`);
    const y = yearsSince(g.fechaDriver);
    if (y != null && y > 0.5) add('recomendado', `El driver de tu ${g.nombre} tiene más de ${y >= 1 ? Math.floor(y) + (Math.floor(y) === 1 ? ' año' : ' años') : '6 meses'}. Actualízalo desde la app oficial (sección Drivers).`, `Your ${g.nombre} driver is over ${y >= 1 ? Math.floor(y) + ' year(s)' : '6 months'} old. Update it from the official app (Drivers section).`);
  }
  if (hw.cpu && hw.cpu.temp && hw.cpu.temp >= 90) add('importante', `El procesador está a ${hw.cpu.temp} °C. Revisa la ventilación y la pasta térmica.`, `The CPU is at ${hw.cpu.temp} °C. Check cooling and thermal paste.`);
  const by = yearsSince(hw.bios && hw.bios.fecha);
  if (by != null && by > 2) add('opcional', `La BIOS de tu placa (${hw.placa.modelo}) es de ${hw.bios.fecha.slice(0, 4)}. Si tienes problemas de estabilidad, mira en la web de ${hw.placa.fabricante} si hay una más nueva. No la actualices si todo funciona bien.`, `Your motherboard BIOS (${hw.placa.modelo}) is from ${hw.bios.fecha.slice(0, 4)}. If you have stability issues, check ${hw.placa.fabricante}'s website. Don't update it if everything works.`);
  if (hw.bateria && hw.bateria.salud && hw.bateria.salud < 70) add('recomendado', `La batería conserva el ${hw.bateria.salud}% de su capacidad original.`, `The battery keeps ${hw.bateria.salud}% of its original capacity.`);
  return out;
}

function buildFindings() {
  const f = [];
  const add = (o) => f.push({ elegido: o.nivel !== 'opcional' && !!o.accion, ...o });
  // Hardware
  for (const a of hardwareAdvice(S.hardware)) add({ id: 'hw' + f.length, nivel: a.nivel, titulo: a.t, detalle: '', accion: null, ir: 'hardware' });
  // Drivers con problemas
  const prob = (S.drivers?.problemas || []).filter((p) => p.codigo !== 45);
  if (prob.length) add({ id: 'pnp', nivel: 'importante', titulo: L(`${prob.length} dispositivo(s) no funcionan bien`, `${prob.length} device(s) are not working properly`), detalle: prob.map((p) => p.dispositivo).join(', '), accion: null, ir: 'drivers' });
  // Actualizaciones
  const wu = S.updates?.windows || [];
  const wuImp = wu.filter((u) => !u.opcional && !u.grande);
  const wuDrv = wu.filter((u) => u.tipo === 'driver');
  if (wuImp.length || wuDrv.length) add({ id: 'wu', nivel: wuImp.some((u) => u.tipo === 'seguridad') ? 'importante' : 'recomendado', titulo: L(`Instalar ${wuImp.length + wuDrv.filter((u) => u.opcional).length} actualización(es) oficiales de Windows y drivers`, `Install ${wuImp.length + wuDrv.filter((u) => u.opcional).length} official Windows and driver update(s)`), detalle: L('Desde Windows Update, la fuente oficial de Microsoft.', 'From Windows Update, Microsoft\'s official source.'), accion: 'wu' });
  const apps = S.updates?.apps || [];
  if (apps.length) add({ id: 'apps', nivel: 'recomendado', titulo: L(`Actualizar ${apps.length} programa(s)`, `Update ${apps.length} program(s)`), detalle: apps.slice(0, 5).map((a) => a.nombre).join(', ') + (apps.length > 5 ? '…' : ''), accion: 'apps' });
  // Basura
  if (S.junk) {
    const verde = S.junk.categorias.filter((c) => c.color === 'verde');
    const total = verde.reduce((a, c) => a + c.tamano, 0);
    if (total > 300 * 1024 ** 2) add({ id: 'junk', nivel: total > 5 * GB ? 'recomendado' : 'opcional', titulo: L(`Liberar ${fmtBytes(total)} de archivos basura`, `Free ${fmtBytes(total)} of junk files`), detalle: L('Temporales y cachés. No toca tus documentos.', 'Temp files and caches. Your documents are not touched.'), accion: 'junk', elegido: true });
  }
  // Bloatware
  const bloat = allPrograms().filter((p) => p.cls.color === 'verde');
  if (bloat.length) add({ id: 'bloat', nivel: 'recomendado', titulo: L(`Quitar ${bloat.length} programa(s) basura preinstalados`, `Remove ${bloat.length} preinstalled bloatware app(s)`), detalle: bloat.slice(0, 6).map((p) => p.cls.nombre).join(', ') + (bloat.length > 6 ? '…' : ''), accion: 'bloat' });
  // Arranque
  const st = (S.startup?.elementos || []).filter((i) => i.activo && classifyStartup(i).rec === 'desactivar');
  if (st.length) add({ id: 'startup', nivel: 'recomendado', titulo: L(`Hacer que Windows arranque más rápido (${st.length} programa(s) innecesarios al inicio)`, `Make Windows start faster (${st.length} unneeded startup program(s))`), detalle: st.map((i) => i.nombre).join(', '), accion: 'startup' });
  const order = { importante: 0, recomendado: 1, opcional: 2 };
  f.sort((a, b) => order[a.nivel] - order[b.nivel]);
  return f;
}

function computeScore() {
  let s = 100;
  const hw = S.hardware;
  if (hw) {
    for (const d of hw.discos || []) { if (d.salud && d.salud !== 'Healthy') s -= 25; if (d.desgaste >= 80) s -= 15; }
    for (const v of hw.unidades || []) { const p = v.total ? v.libre / v.total : 1; if (p < 0.1) s -= 12; else if (p < 0.2) s -= 5; }
    if (hw.sistema?.build && hw.sistema.build < 22000) s -= 12;
    if (hw.sistema?.diasEncendido >= 7) s -= 3;
  }
  s -= Math.min(20, ((S.drivers?.problemas || []).filter((p) => p.codigo !== 45).length) * 8);
  const wu = (S.updates?.windows || []).filter((u) => !u.opcional && !u.grande);
  if (wu.some((u) => u.tipo === 'seguridad')) s -= 10; else if (wu.length) s -= 5;
  s -= Math.min(6, (S.updates?.apps || []).length);
  if (S.junk) { const t = S.junk.categorias.filter((c) => c.color === 'verde').reduce((a, c) => a + c.tamano, 0); if (t > 5 * GB) s -= 8; else if (t > 1 * GB) s -= 4; }
  const b = allPrograms().filter((p) => p.cls.color === 'verde').length; s -= Math.min(8, b);
  const st = (S.startup?.elementos || []).filter((i) => i.activo && classifyStartup(i).rec === 'desactivar').length; s -= Math.min(6, st * 1.5);
  return Math.max(5, Math.min(100, Math.round(s)));
}
function scoreLabel(n) {
  if (n >= 85) return L('Muy bien', 'Great');
  if (n >= 65) return L('Mejorable', 'Could be better');
  if (n >= 45) return L('Necesita atención', 'Needs attention');
  return L('Necesita ayuda', 'Needs help');
}

// ============================================================ Acciones principales
// [id, script, peso en la barra de progreso, texto es, texto en, función]
const SCAN_STEPS = [
  ['hardware', 'hardware', 8, 'Leyendo tu hardware y la salud de los discos', 'Reading your hardware and disk health', loadHardware],
  ['drivers', 'drivers', 10, 'Revisando drivers y dispositivos', 'Checking drivers and devices', loadDrivers],
  ['programas', 'programas', 17, 'Buscando programas y bloatware', 'Looking for programs and bloatware', loadPrograms],
  ['limpieza', 'limpieza', 25, 'Midiendo archivos basura', 'Measuring junk files', loadJunk],
  ['inicio', 'inicio', 5, 'Revisando lo que arranca con Windows', 'Checking startup programs', loadStartup],
  ['updates', 'actualizaciones', 35, 'Buscando actualizaciones oficiales', 'Looking for official updates', loadUpdates]
];
function scanPct() {
  let done = 0, total = 0;
  for (const [id, script, w] of SCAN_STEPS) {
    total += w;
    const st = S.scan.steps[id];
    if (st === 'ok' || st === 'err') done += w;
    else if (st === 'run') done += w * Math.min(95, S.scan.pct[script] || 0) / 100;
  }
  return Math.round((done / total) * 100);
}

// Todos los análisis son de solo lectura, así que corren a la vez (mucho más rápido).
async function scanAll() {
  S.view = 'inicio'; S.fix = null;
  S.scan = { state: 'running', steps: {}, pct: {}, findings: [], score: null };
  await task(L('Revisando tu PC', 'Checking your PC'), async () => {
    await Promise.all(SCAN_STEPS.map(async ([id, script, , , , fn]) => {
      S.scan.steps[id] = 'run'; render();
      try { await fn(); S.scan.steps[id] = 'ok'; }
      catch (e) { if (!isCancel(e)) console.error(id, e); S.scan.steps[id] = isCancel(e) ? 'cancel' : 'err'; S.scan.errors = { ...(S.scan.errors || {}), [id]: String(e.message || e).slice(0, 300) }; }
      if (S.busy) S.busy.pct = scanPct();
      render();
    }));
    if (S.cancelRequested) { S.scan.state = 'idle'; throw new Error('CANCELADO'); }
    S.scan.findings = buildFindings();
    S.scan.score = computeScore();
    S.scan.state = 'done';
    S.scan.date = new Date();
  });
  if (S.scan.state === 'running') S.scan.state = 'idle';   // por si algo inesperado cortó el análisis
}

async function uninstallPrograms(list, motivo) {
  // list: programas ya clasificados. Devuelve resumen.
  const res = { ok: 0, fail: [], restosMovidos: 0, bytes: 0, dudosos: [], reinicio: false };
  await restorePoint(motivo);
  let i = 0;
  for (const p of list) {
    if (S.cancelRequested) { res.cancelado = true; break; }
    i++;
    if (S.busy) { S.busy.label = L(`Desinstalando (${i}/${list.length})`, `Uninstalling (${i}/${list.length})`); S.busy.msg = p.cls.nombre; S.busy.pct = Math.round(((i - 1) / list.length) * 100); updateProgressOnly(); setStatus(S.busy.label + ' · ' + p.cls.nombre); }
    const r = await rl.run('desinstalar', { ...p, cls: undefined, etiqueta: p.cls.nombre, permitirVentana: true });
    if (r.reinicio) res.reinicio = true;
    if (!r.ok) { res.fail.push(p.cls.nombre); continue; }
    res.ok++;
    if (p.tipo === 'win32') {
      const rr = await rl.run('residuos', { nombre: p.nombre, editor: p.editor, carpeta: p.carpeta, clave: p.clave });
      rr.restos = arr(rr.restos);
      const altos = rr.restos.filter((x) => x.confianza === 'alta');
      const dudosos = rr.restos.filter((x) => x.confianza !== 'alta');
      if (S.settings.restosAutomaticos && altos.length) {
        const q = await rl.run('cuarentena', { accion: 'mover', items: altos, motivo: L('Restos de ', 'Leftovers of ') + p.nombre });
        res.restosMovidos += q.guardados; res.bytes += q.bytes || 0;
      } else dudosos.unshift(...altos);
      if (dudosos.length) res.dudosos.push({ programa: p.nombre, restos: dudosos.map((d) => ({ ...d, elegido: d.confianza === 'alta' })) });
    }
  }
  if (res.reinicio) S.needsReboot = true;
  return res;
}

async function updateSelected() {
  const wuIds = [...S.updSel].filter((k) => k.startsWith('wu:')).map((k) => k.slice(3));
  const wgIds = [...S.updSel].filter((k) => k.startsWith('wg:')).map((k) => k.slice(3));
  if (!wuIds.length && !wgIds.length) return;
  await taskC(L('Actualizando lo seleccionado', 'Updating selection'), async () => {
    await restorePoint(L('Antes de actualizar', 'Before updating'));
    let ok = 0, bad = [];
    if (wuIds.length) {
      S.busy.label = 'Windows Update'; render();
      const r = await rl.run('actualizaciones', { accion: 'instalarWU', ids: wuIds });
      for (const x of arr(r.resultados)) { if (x.ok) { ok++; S.updSel.delete('wu:' + x.id); } else bad.push(x.titulo || x.id); }
      if (r.reinicio) S.needsReboot = true;
      S.updates.windows = S.updates.windows.filter((u) => !arr(r.resultados).some((x) => x.ok && x.id === u.id));
    }
    checkCancel();
    if (wgIds.length) {
      // Uno por uno: así Cancelar puede parar entre programa y programa
      let i = 0;
      for (const id of wgIds) {
        if (S.cancelRequested) break;
        const app = S.updates.apps.find((a) => a.id === id);
        S.busy.label = L(`Actualizando programas (${++i}/${wgIds.length})`, `Updating programs (${i}/${wgIds.length})`);
        S.busy.msg = app ? app.nombre : id; S.busy.pct = Math.round(((i - 1) / wgIds.length) * 100); render();
        const r = await rl.run('actualizaciones', { accion: 'winget', ids: [id] });
        const x = arr(r.resultados)[0];
        if (x && x.ok) { ok++; S.updSel.delete('wg:' + id); S.updates.apps = S.updates.apps.filter((a) => a.id !== id); }
        else bad.push(app ? app.nombre : id);
      }
    }
    toast(L(`${ok} actualizado(s) correctamente.`, `${ok} updated successfully.`));
    if (bad.length) toast(L('No se pudieron actualizar (quizá estaban abiertos): ', 'Could not update (maybe they were open): ') + bad.join(', '), 'err');
  });
}

async function fixAll() {
  const chosen = S.scan.findings.filter((f) => f.elegido && f.accion);
  if (!chosen.length) { toast(L('No hay nada seleccionado para arreglar.', 'Nothing selected to fix.'), 'err'); return; }
  S.fix = { steps: chosen.map((f) => ({ id: f.accion, titulo: f.titulo, state: 'wait', extra: '' })), done: false, summary: [] };
  await taskC(L('Arreglando tu PC', 'Fixing your PC'), async () => {
    S.busy.msg = L('Creando punto de restauración...', 'Creating restore point...'); render();
    await rl.run('restauracion', { accion: 'crear', motivo: L('Antes de arreglar todo', 'Before fix all') }).catch(() => {});
    const saved = S.settings.puntoRestauracion; S.settings.puntoRestauracion = false; // ya creado
    try {
      let n = 0;
      for (const st of S.fix.steps) {
        if (S.cancelRequested) { st.state = 'cancel'; st.extra = L('Cancelado', 'Cancelled'); continue; }
        S.busy.pct = Math.round((n++ / S.fix.steps.length) * 100); S.busy.msg = st.titulo;
        st.state = 'run'; render();
        try {
          if (st.id === 'junk') {
            const cats = S.junk.categorias.filter((c) => c.color === 'verde' && c.tamano > 0).map((c) => c.id);
            const r = await rl.run('limpieza', { accion: 'limpiar', categorias: cats });
            st.extra = L('Liberado ', 'Freed ') + fmtBytes(r.liberado);
          } else if (st.id === 'bloat') {
            const list = allPrograms().filter((p) => p.cls.color === 'verde');
            const r = await uninstallPrograms(list, L('Quitar bloatware', 'Remove bloatware'));
            st.extra = L(`${r.ok} quitados`, `${r.ok} removed`) + (r.fail.length ? L(`, ${r.fail.length} no se pudieron`, `, ${r.fail.length} failed`) : '');
            if (r.dudosos.length) S.pendingResidues = r.dudosos;
          } else if (st.id === 'startup') {
            const list = S.startup.elementos.filter((i) => i.activo && classifyStartup(i).rec === 'desactivar');
            for (const it of list) await rl.run('inicio', { accion: 'cambiar', id: it.id, activar: false });
            st.extra = L(`${list.length} desactivados`, `${list.length} disabled`);
          } else if (st.id === 'wu') {
            const r = await rl.run('actualizaciones', { accion: 'instalarWU', todos: true });
            const ok = r.resultados.filter((x) => x.ok).length;
            st.extra = L(`${ok} de ${r.resultados.length} instaladas`, `${ok} of ${r.resultados.length} installed`);
            if (r.reinicio) S.needsReboot = true;
          } else if (st.id === 'apps') {
            const r = await rl.run('actualizaciones', { accion: 'winget', todos: true });
            st.extra = L(`${r.resultados.filter((x) => x.ok).length} actualizados`, `${r.resultados.filter((x) => x.ok).length} updated`);
          }
          st.state = 'ok';
        } catch (e) { console.error(e); st.state = 'err'; st.extra = String(e.message || e).slice(0, 80); }
        render();
      }
    } finally { S.settings.puntoRestauracion = saved; }
    S.fix.done = true;
    S.fix.cancelado = S.fix.steps.some((x) => x.state === 'cancel');
    // Re-escaneo rápido para actualizar la nota
    S.busy.label = L('Volviendo a medir', 'Measuring again'); S.busy.msg = ''; render();
    await Promise.allSettled([loadJunk(), loadPrograms(), loadStartup()]);
    S.updates = S.updates ? { ...S.updates, windows: [], apps: [] } : S.updates;
    S.scan.findings = buildFindings(); S.scan.score = computeScore();
  });
  if (S.fix && !S.fix.cancelado) toast(L('¡Listo! Tu PC está más limpio.', 'Done! Your PC is cleaner.'));
}

// ============================================================ Vistas
const ICONS = {
  inicio: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  programas: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7"/>',
  limpieza: '<path d="M14 3l7 7M4 20l7-7M9.5 8.5l6 6-2.5 5.5-9-9z"/><path d="M5 4v3M3.5 5.5h3"/>',
  arranque: '<path d="M12 3v8"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>',
  hardware: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  drivers: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
  actualizaciones: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  deshacer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  procesos: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
const NAV = [
  ['inicio', 'Revisar mi PC', 'Check my PC'],
  ['programas', 'Programas y bloatware', 'Programs & bloatware'],
  ['limpieza', 'Limpieza', 'Cleanup'],
  ['arranque', 'Arranque de Windows', 'Windows startup'],
  'sep',
  ['hardware', 'Hardware y salud', 'Hardware & health'],
  ['drivers', 'Drivers', 'Drivers'],
  ['actualizaciones', 'Actualizaciones', 'Updates'],
  ['procesos', 'Procesos (avanzado)', 'Processes (advanced)'],
  'sep',
  ['deshacer', 'Deshacer y cuarentena', 'Undo & quarantine'],
  ['ajustes', 'Ajustes', 'Settings']
];

function navCount(id) {
  if (id === 'programas' && S.programs) { const n = allPrograms().filter((p) => p.cls.color === 'verde').length; return n ? [n, ''] : null; }
  if (id === 'limpieza' && S.junk) { const t = S.junk.categorias.reduce((a, c) => a + c.tamano, 0); return t > 0 ? [fmtBytes(t), ''] : null; }
  if (id === 'drivers' && S.drivers) { const n = S.drivers.problemas.filter((p) => p.codigo !== 45).length; return n ? [n, 'alerta'] : null; }
  if (id === 'actualizaciones' && S.updates) { const n = S.updates.windows.length + S.updates.apps.length; return n ? [n, ''] : null; }
  if (id === 'hardware' && S.hardware) { const n = hardwareAdvice(S.hardware).filter((a) => a.nivel === 'importante').length; return n ? [n, 'alerta'] : null; }
  return null;
}
function renderNav() {
  $('#nav').innerHTML = NAV.map((n) => {
    if (n === 'sep') return '<div class="nav-sep"></div>';
    const [id, es, en] = n; const c = navCount(id);
    return `<button class="nav-item ${S.view === id ? 'active' : ''}" data-nav="${id}"><svg viewBox="0 0 24 24">${ICONS[id]}</svg><span>${L(es, en)}</span>${c ? `<span class="count ${c[1]}">${esc(c[0])}</span>` : ''}</button>`;
  }).join('') + `<div class="nav-foot">${/^https:\/\//.test(S.info.paypal || '') ? `<div class="donate"><div class="d-title"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>${L('Tu donación lo mantiene vivo', 'Your donation keeps it alive')}</div>
    <p>${L('No hay empresa detrás: hay una persona que le dedica sus noches. Si te ayudó, donar, por poco que sea, lo mantiene vivo para todos.', 'No company behind it: one person giving it their nights. If it helped you, donating, however little, keeps it alive for everyone.')}</p>
    <button class="donate-btn big-donate" data-act="donateAsk">${L('Donar con PayPal', 'Donate with PayPal')}</button><div class="d-note">${L('Cada donación cuenta 💜', 'Every donation counts 💜')}</div></div>` : ''}${repoUrl() ? `<button class="gh-btn" data-open="${repoUrl()}" title="${L('Revisar el código abierto en GitHub', 'Review the open source code on GitHub')}">${GH_ICON}<span>${L('Ver el código en GitHub', 'View code on GitHub')}</span></button>` : ''}<div class="trust">${L('Sin telemetría · Código abierto', 'No telemetry · Open source')}</div>${L('Todo lo que borra se puede deshacer.', 'Everything it removes can be undone.')}</div>`;
}

function head(title, desc, right = '') {
  return `<div class="view-head"><div><h1>${title}</h1><p>${desc}</p></div><div>${right}</div></div>`;
}
function banners() {
  let h = '';
  if (S.info.demo) h += `<div class="banner info"><div class="grow"><b>${L('Modo demostración', 'Demo mode')}</b> · ${L('Los datos son de ejemplo y no se cambia nada en este equipo.', 'Sample data; nothing on this computer is changed.')}</div></div>`;
  if (!S.info.esAdmin) h += `<div class="banner warn"><div class="grow"><b>${L('Abre RetroLimpia como administrador', 'Run RetroLimpia as administrator')}</b> · ${L('Sin permisos de administrador no puede desinstalar ni actualizar drivers. Ciérralo, haz clic derecho en su icono y elige "Ejecutar como administrador".', 'Without admin rights it cannot uninstall or update drivers. Close it, right-click its icon and choose "Run as administrator".')}</div></div>`;
  if (S.needsReboot) h += `<div class="banner warn"><div class="grow"><b>${L('Reinicia el PC cuando puedas', 'Restart your PC when you can')}</b> · ${L('Algunas actualizaciones o desinstalaciones terminan al reiniciar.', 'Some updates or uninstalls finish after a restart.')}</div></div>`;
  const up = S.upd || {};
  if (up.estado === 'lista') h += `<div class="banner good"><div class="grow"><b>${L('¡RetroLimpia ' + esc(up.version) + ' está lista!', 'RetroLimpia ' + esc(up.version) + ' is ready!')}</b> · ${L('Ya se descargó. Tarda unos segundos y vuelve a abrirse solo.', 'Already downloaded. Takes a few seconds and reopens by itself.')}</div><button class="btn primary small" data-act="installUpdate" ${S.busy ? 'disabled' : ''}>${L('Reiniciar y actualizar', 'Restart and update')}</button></div>`;
  else if (up.estado === 'descargando') h += `<div class="banner info"><div class="grow"><b>${L('Descargando RetroLimpia ' + esc(up.version || ''), 'Downloading RetroLimpia ' + esc(up.version || ''))}</b> · ${up.pct || 0}% · ${L('puedes seguir usándolo mientras tanto', 'you can keep using it meanwhile')}</div></div>`;
  else if (S.appUpdate?.disponible && S.appUpdate.modo === 'manual') h += `<div class="banner good"><div class="grow"><b>${L('Hay una versión nueva de RetroLimpia', 'A new RetroLimpia version is available')} (${esc(S.appUpdate.version)})</b> · ${L('La versión portable no se actualiza sola: descarga la nueva y reemplaza este archivo.', 'The portable version cannot self-update: download the new one and replace this file.')}</div><button class="btn small" data-open="${esc(S.appUpdate.url)}">${L('Descargar', 'Download')}</button></div>`;
  return h;
}

function viewInicio() {
  const sc = S.scan;
  const score = sc.score;
  const C = 2 * Math.PI * 80;
  const ring = `<div class="ring"><svg viewBox="0 0 190 190"><defs><linearGradient id="ringGrad" x1="0" x2="1"><stop offset="0" stop-color="#ff3d9a"/><stop offset=".5" stop-color="#b14dff"/><stop offset="1" stop-color="#2de2e6"/></linearGradient></defs>
    <circle class="track" cx="95" cy="95" r="80" fill="none" stroke-width="14"/>
    <circle class="bar" cx="95" cy="95" r="80" fill="none" stroke-width="14" stroke-dasharray="${C}" stroke-dashoffset="${score == null ? C : C * (1 - score / 100)}"/></svg>
    <div class="val"><div><div class="num">${score == null ? '—' : score}</div><div class="lbl">${score == null ? L('Salud del PC', 'PC health') : scoreLabel(score)}</div></div></div></div>`;

  let body = '';
  if (sc.state === 'idle') {
    body = `<div class="hero"><div class="hero-text">
      <h1>${L('Deja tu PC como nuevo', 'Make your PC feel new again')}</h1>
      <p>${L('Pulsa el botón y RetroLimpia revisa todo: programas basura, archivos inútiles, drivers, actualizaciones y la salud de tus discos. No cambia nada hasta que tú lo confirmes.', 'Press the button and RetroLimpia checks everything: bloatware, junk files, drivers, updates and disk health. Nothing changes until you confirm.')}</p>
      <button class="btn primary big" data-act="scan" ${S.busy ? 'disabled' : ''}>${L('Revisar mi PC', 'Check my PC')}</button>
      <div class="note">${L('Tarda de 1 a 4 minutos.', 'Takes 1 to 4 minutes.')}</div></div>${ring}</div>`;
  } else if (sc.state === 'running') {
    body = `<div class="hero"><div class="hero-text"><h1>${L('Revisando tu PC...', 'Checking your PC...')}</h1><p>${L('Puedes seguir usando el PC mientras tanto.', 'You can keep using your PC meanwhile.')}</p></div>${ring}</div>
      ${progressHTML()}
      <div class="stepper">${SCAN_STEPS.map(([id, , , es, en]) => `<div class="step ${sc.steps[id] || ''}"><span class="dot"></span>${L(es, en)}<span class="extra">${sc.steps[id] === 'err' ? L('No se pudo leer', 'Could not read') : sc.steps[id] === 'ok' ? L('Listo', 'Done') : ''}</span></div>`).join('')}</div>`;
  } else {
    const fx = S.fix;
    if (fx) {
      body = `<div class="hero"><div class="hero-text"><h1>${fx.done ? (fx.cancelado ? L('Detenido', 'Stopped') : L('¡Listo!', 'Done!')) : L('Arreglando tu PC...', 'Fixing your PC...')}</h1><p>${fx.done ? (fx.cancelado ? L('Se detuvo al terminar el paso que estaba en marcha. Lo que se llegó a hacer está en la cuarentena por si quieres deshacerlo.', 'Stopped after the step in progress. Anything already done is in quarantine in case you want to undo it.') : L('Todo lo que se quitó está en la cuarentena unos días por si quieres deshacerlo.', 'Everything removed stays in quarantine for a few days in case you want to undo it.')) : L('No apagues el PC. Esto puede tardar varios minutos si hay actualizaciones.', "Don't turn off your PC. This may take several minutes if there are updates.")}</p>
        ${fx.done ? `<button class="btn" data-act="closeFix">${L('Ver el resumen', 'See summary')}</button> <button class="btn ghost" data-act="report">${L('Guardar informe', 'Save report')}</button>` : ''}</div>${ring}</div>
        ${fx.done ? '' : progressHTML()}
        <div class="stepper">${fx.steps.map((s) => `<div class="step ${s.state === 'wait' ? '' : s.state}"><span class="dot"></span>${esc(s.titulo)}<span class="extra">${esc(s.extra)}</span></div>`).join('')}</div>`;
    } else {
      const fs = sc.findings;
      const chosen = fs.filter((f) => f.elegido && f.accion).length;
      body = `<div class="hero"><div class="hero-text">
        <h1>${fs.length ? L(`Encontramos ${fs.length} cosa(s) para mejorar`, `We found ${fs.length} thing(s) to improve`) : L('¡Tu PC está en muy buen estado!', 'Your PC is in great shape!')}</h1>
        <p>${fs.length ? L('Ya marcamos lo recomendado. Revísalo si quieres, o pulsa "Arreglar todo".', "We've already ticked what we recommend. Review it if you like, or press \"Fix all\".") : L('No hay nada importante que arreglar ahora mismo.', 'Nothing important to fix right now.')}</p>
        <button class="btn ghost" data-act="scan" ${S.busy ? 'disabled' : ''}>${L('Volver a revisar', 'Check again')}</button> <button class="btn ghost" data-act="report">${L('Guardar informe', 'Save report')}</button></div>${ring}</div>
        ${Object.keys(sc.errors || {}).length ? `<div class="banner warn" style="margin-top:16px"><div class="grow"><b>${L('Algunas partes no se pudieron revisar', 'Some parts could not be checked')}</b> · ${SCAN_STEPS.filter(([id]) => sc.errors[id]).map(([, , , es, en]) => L(es, en)).join(', ')}. ${L('El resto del análisis es válido.', 'The rest of the check is valid.')}</div></div>` : ''}
        ${fs.length ? `<h2>${L('Lo que encontramos', 'What we found')}</h2>` : ''}
        ${fs.map((f) => `<div class="finding ${f.nivel}">
          ${f.accion ? `<input type="checkbox" class="check" data-finding="${f.id}" ${f.elegido ? 'checked' : ''}>` : '<span style="width:20px"></span>'}
          <div class="txt"><div class="t">${esc(f.titulo)}</div>${f.detalle ? `<div class="d">${esc(f.detalle)}</div>` : ''}</div>
          <span class="badge ${f.nivel === 'importante' ? 'rojo' : f.nivel === 'recomendado' ? 'amarillo' : 'gris'}">${f.nivel === 'importante' ? L('Importante', 'Important') : f.nivel === 'recomendado' ? L('Recomendado', 'Recommended') : L('Opcional', 'Optional')}</span>
          <button class="btn small ghost" data-nav="${f.ir || ({ junk: 'limpieza', bloat: 'programas', startup: 'arranque', wu: 'actualizaciones', apps: 'actualizaciones' })[f.accion] || 'inicio'}">${L('Ver', 'View')}</button></div>`).join('')}
        ${chosen ? `<div class="actionbar"><div class="info">${L(`<b>${chosen}</b> mejora(s) seleccionadas. Antes crearemos un punto de restauración.`, `<b>${chosen}</b> improvement(s) selected. A restore point is created first.`)}</div>
          <button class="btn" data-nav="programas">${L('Elegir yo qué arreglar', 'Let me choose')}</button>
          <button class="btn primary" data-act="fixAll" ${S.busy ? 'disabled' : ''}>${L('Arreglar todo', 'Fix all')}</button></div>` : ''}`;
    }
  }
  return `<div class="view">${banners()}${body}</div>`;
}

function residuesReviewHTML() {
  if (!S.pendingResidues?.length) return '';
  return `<div class="card" style="margin-bottom:18px;border-color:var(--amarillo)"><h3>${L('Revisa estos posibles restos', 'Review these possible leftovers')}</h3>
    <p class="meta">${L('No estamos 100% seguros de que sean del programa que quitaste. Marca solo lo que reconozcas. Irá a la cuarentena, no se borra todavía.', "We're not 100% sure they belong to the program you removed. Only tick what you recognise. It goes to quarantine, nothing is deleted yet.")}</p>
    ${S.pendingResidues.map((g, gi) => `<div style="margin-top:12px"><b>${esc(g.programa)}</b><div class="list" style="margin-top:6px">${g.restos.map((r, ri) => `<div class="row"><input type="checkbox" class="check" data-res="${gi}:${ri}" ${r.elegido ? 'checked' : ''}><div class="grow"><div class="name">${esc(r.ruta)}</div><div class="sub">${r.tipo === 'registro' ? L('Entrada del registro', 'Registry entry') : r.tipo === 'carpeta' ? L('Carpeta', 'Folder') : L('Archivo', 'File')} · ${r.confianza === 'alta' ? L('casi seguro', 'very likely') : L('posible', 'possible')}</div></div><div class="size">${r.tamano ? fmtBytes(r.tamano) : ''}</div></div>`).join('')}</div></div>`).join('')}
    <div style="margin-top:14px;display:flex;gap:10px"><button class="btn primary" data-act="moveResidues">${L('Mover lo marcado a la cuarentena', 'Move ticked items to quarantine')}</button><button class="btn ghost" data-act="skipResidues">${L('Dejarlo como está', 'Leave it')}</button></div></div>`;
}

// Impacto en el sistema: lo que un programa hace aunque no lo estés usando
function programImpact(p) {
  const why = [];
  let pts = 0;
  const loc = String(p.carpeta || '').replace(/"/g, '').toLowerCase().replace(/\\$/, '');
  const arranca = (S.startup?.elementos || []).some((i) => i.activo && ((loc.length > 6 && String(i.comando).toLowerCase().includes(loc)) || (p.tipo === 'win32' && i.nombre.length > 3 && p.nombre.toLowerCase().startsWith(i.nombre.toLowerCase()))));
  if (arranca) { pts += 2; why.push(L('arranca con Windows', 'starts with Windows')); }
  if (p.serviciosAuto > 0) { pts += 2; why.push(L(`${p.serviciosAuto} servicio(s) siempre activos`, `${p.serviciosAuto} always-on service(s)`)); }
  else if (p.servicios > 0) { pts += 1; why.push(L(`${p.servicios} servicio(s)`, `${p.servicios} service(s)`)); }
  if (p.ram > 300 * 1024 ** 2) { pts += 2; why.push(L(`usa ${fmtBytes(p.ram)} de RAM ahora`, `using ${fmtBytes(p.ram)} RAM now`)); }
  else if (p.ram > 60 * 1024 ** 2) { pts += 1; why.push(L(`usa ${fmtBytes(p.ram)} de RAM ahora`, `using ${fmtBytes(p.ram)} RAM now`)); }
  const nivel = pts >= 4 ? 'alto' : pts >= 2 ? 'medio' : 'bajo';
  return { nivel, pts, why };
}
const IMPACT = { alto: ['rojo', 'Impacto alto', 'High impact'], medio: ['amarillo', 'Impacto medio', 'Medium impact'], bajo: ['verde', 'Impacto bajo', 'Low impact'] };

function viewProgramas() {
  if (!S.programs) return loadingView(L('Programas y bloatware', 'Programs & bloatware'), async () => { await loadPrograms(); if (!S.startup) await loadStartup().catch(() => {}); });
  const all = allPrograms().map((p) => ({ ...p, imp: programImpact(p) }));
  const q = S.search.toLowerCase();
  const filt = all.filter((p) => {
    if (q && !(p.cls.nombre + ' ' + p.editor + ' ' + p.nombre).toLowerCase().includes(q)) return false;
    switch (S.progFilter) {
      case 'verde': return p.cls.color === 'verde';
      case 'amarillo': return p.cls.color === 'amarillo';
      case 'store': return p.tipo === 'appx';
      case 'clasicos': return p.tipo === 'win32';
      case 'impacto': return p.imp.nivel !== 'bajo';
      default: return S.settings.modoExperto || p.tipo === 'win32' || p.cls.color;
    }
  });
  const rank = { verde: 0, amarillo: 1, null: 2, rojo: 3 };
  const sorts = {
    rec: (a, b) => (rank[a.cls.color] - rank[b.cls.color]) || a.cls.nombre.localeCompare(b.cls.nombre),
    peso: (a, b) => (b.tamano || 0) - (a.tamano || 0),
    impacto: (a, b) => (b.imp.pts - a.imp.pts) || (b.ram || 0) - (a.ram || 0),
    nombre: (a, b) => a.cls.nombre.localeCompare(b.cls.nombre)
  };
  S.progSort = S.progSort || 'rec';
  filt.sort(sorts[S.progSort]);
  const maxSize = Math.max(1, ...filt.map((p) => p.tamano || 0));
  const totalSize = all.reduce((a, p) => a + (p.tamano || 0), 0);
  const nAlto = all.filter((p) => p.imp.nivel === 'alto').length;
  const selList = all.filter((p) => S.sel.has(p.id));
  const selSize = selList.reduce((a, p) => a + (p.tamano || 0), 0);
  const chips = [['todos', 'Todos', 'All'], ['verde', 'Seguro quitar', 'Safe to remove'], ['amarillo', 'Opcionales', 'Optional'], ['impacto', 'Con impacto', 'With impact'], ['clasicos', 'Programas', 'Programs'], ['store', 'Store', 'Store']];
  const sortOpts = [['rec', 'Recomendado', 'Recommended'], ['peso', 'Más pesados', 'Largest'], ['impacto', 'Mayor impacto', 'Highest impact'], ['nombre', 'Nombre (A-Z)', 'Name (A-Z)']];
  const nVerde = all.filter((p) => p.cls.color === 'verde').length;
  return `<div class="view">${banners()}${head(L('Programas y bloatware', 'Programs & bloatware'), L(`${all.length} programas ocupan <b>${fmtBytes(totalSize)}</b>${nAlto ? ` · <b>${nAlto}</b> con impacto alto en el sistema` : ''}. Desinstala sin ventanas y sin dejar restos.`, `${all.length} programs take up <b>${fmtBytes(totalSize)}</b>${nAlto ? ` · <b>${nAlto}</b> with high system impact` : ''}. Uninstall without pop-ups or leftovers.`), nVerde ? `<button class="btn" data-act="selVerde">${L(`Marcar los ${nVerde} recomendados`, `Tick the ${nVerde} recommended`)}</button>` : '')}
    ${progressHTML()}${residuesReviewHTML()}
    <div class="toolbar"><input class="search" id="search" placeholder="${L('Buscar un programa...', 'Search a program...')}" value="${esc(S.search)}">
      <label class="sortsel">${L('Ordenar:', 'Sort:')} <select data-sort>${sortOpts.map(([id, es, en]) => `<option value="${id}" ${S.progSort === id ? 'selected' : ''}>${L(es, en)}</option>`).join('')}</select></label></div>
    <div class="toolbar">${chips.map(([id, es, en]) => `<button class="chip ${S.progFilter === id ? 'on' : ''}" data-filter="${id}">${L(es, en)}</button>`).join('')}</div>
    <div class="list">${filt.length ? filt.map((p) => {
      const blocked = p.cls.color === 'rojo' && !S.settings.modoExperto;
      const [ic, ies, ien] = IMPACT[p.imp.nivel];
      return `<label class="row ${blocked ? 'disabled' : ''}"><input type="checkbox" class="check" data-sel="${esc(p.id)}" ${S.sel.has(p.id) ? 'checked' : ''} ${blocked ? 'disabled' : ''}>
        <div class="grow"><div class="name">${esc(p.cls.nombre)}${p.tipo === 'appx' ? ' <span class="badge gris">Store</span>' : ''}</div><div class="sub">${esc(p.cls.nota || [p.editor, p.version].filter(Boolean).join(' · '))}</div>
        ${p.imp.why.length ? `<div class="why-line">${esc(p.imp.why.join(' · '))}</div>` : ''}
        ${S.settings.modoExperto ? `<div class="tech">${esc(p.tipo === 'appx' ? p.paquete : (p.desinstalarSilencioso || p.desinstalar))}</div>` : ''}</div>
        ${p.cls.color ? `<span class="badge ${p.cls.color}">${L(...COLOR_TXT[p.cls.color])}</span>` : ''}
        <span class="badge ${ic}" title="${esc(p.imp.why.join(', ') || L('No hace nada mientras no lo usas', 'Does nothing while not in use'))}">${L(ies, ien)}</span>
        <div class="weight"><b>${p.tamano ? fmtBytes(p.tamano) : '—'}</b><i style="width:${p.tamano ? Math.max(3, Math.round(100 * p.tamano / maxSize)) : 0}%"></i></div></label>`;
    }).join('') : `<div class="empty">${L('No hay programas que coincidan.', 'No matching programs.')}</div>`}</div>
    ${S.sel.size ? `<div class="actionbar"><div class="info">${L(`<b>${S.sel.size}</b> seleccionado(s)`, `<b>${S.sel.size}</b> selected`)}${selSize ? ' · ' + L('liberarás ', 'frees ') + '<b>' + fmtBytes(selSize) + '</b>' : ''}. ${L('Se buscarán sus restos al terminar.', 'Leftovers will be searched afterwards.')}</div>
      <button class="btn ghost" data-act="selNone">${L('Quitar selección', 'Clear')}</button>
      <button class="btn primary" data-act="uninstallSel" ${S.busy ? 'disabled' : ''}>${L('Desinstalar', 'Uninstall')} (${S.sel.size})</button></div>` : ''}</div>`;
}

function viewLimpieza() {
  if (!S.junk) return loadingView(L('Limpieza', 'Cleanup'), loadJunk);
  const cats = S.junk.categorias;
  const total = cats.filter((c) => S.junkSel.has(c.id)).reduce((a, c) => a + c.tamano, 0);
  return `<div class="view">${banners()}${head(L('Limpieza', 'Cleanup'), L('Borra archivos que no sirven para nada. Nunca toca tus documentos, fotos, contraseñas ni historial.', 'Deletes useless files. Never touches your documents, photos, passwords or history.'), `<button class="btn ghost" data-act="reloadJunk">${L('Volver a medir', 'Measure again')}</button>`)}
    ${progressHTML()}
    <div class="list">${cats.map((c) => { const [es, en, des, den] = JUNK[c.id] || [c.id, c.id, '', '']; return `<label class="row ${c.tamano ? '' : 'disabled'}"><input type="checkbox" class="check" data-junk="${c.id}" ${S.junkSel.has(c.id) ? 'checked' : ''} ${c.tamano ? '' : 'disabled'}>
      <div class="grow"><div class="name">${L(es, en)}</div><div class="note">${L(des, den)}</div></div>
      <span class="badge ${c.color}">${c.color === 'verde' ? L('Seguro', 'Safe') : L('Revisa antes', 'Check first')}</span><div class="size">${fmtBytes(c.tamano)}</div></label>`; }).join('')}</div>
    <div class="actionbar"><div class="info">${L('Seleccionado:', 'Selected:')} <b>${fmtBytes(total)}</b></div>
      <button class="btn primary" data-act="clean" ${!total || S.busy ? 'disabled' : ''}>${L('Liberar ', 'Free ')}${fmtBytes(total)}</button></div></div>`;
}

function viewArranque() {
  if (!S.startup) return loadingView(L('Arranque de Windows', 'Windows startup'), loadStartup);
  const items = S.startup.elementos.map((i) => ({ ...i, c: classifyStartup(i) }));
  const rank = { desactivar: 0, opcional: 1, desconocido: 2, mantener: 3 };
  items.sort((a, b) => rank[a.c.rec] - rank[b.c.rec] || a.nombre.localeCompare(b.nombre));
  const pend = items.filter((i) => i.activo && i.c.rec === 'desactivar').length;
  const active = items.filter((i) => i.activo).length;
  return `<div class="view">${banners()}${head(L('Arranque de Windows', 'Windows startup'), L(`${active} programa(s) se abren solos al encender el PC. Menos programas = Windows arranca más rápido. Desactivar no borra nada.`, `${active} program(s) open by themselves at boot. Fewer programs = faster startup. Disabling deletes nothing.`))}
    ${progressHTML()}
    <div class="list">${items.length ? items.map((i) => `<div class="row"><div class="grow"><div class="name">${esc(i.nombre)}</div><div class="sub">${esc(i.c.nota)}</div>${S.settings.modoExperto ? `<div class="tech">${esc(i.comando)}</div>` : ''}</div>
      <span class="badge ${REC[i.c.rec].c}">${L(REC[i.c.rec].es, REC[i.c.rec].en)}</span>
      <label class="switch" title="${i.activo ? L('Activo', 'Enabled') : L('Desactivado', 'Disabled')}"><input type="checkbox" data-startup="${esc(i.id)}" ${i.activo ? 'checked' : ''} ${S.busy ? 'disabled' : ''}><span></span></label></div>`).join('') : `<div class="empty">${L('No hay programas al inicio.', 'No startup programs.')}</div>`}</div>
    ${pend ? `<div class="actionbar"><div class="info">${L(`<b>${pend}</b> se pueden desactivar sin problema.`, `<b>${pend}</b> can be safely disabled.`)}</div><button class="btn primary" data-act="startupRec">${L('Aplicar recomendación', 'Apply recommendation')}</button></div>` : ''}</div>`;
}

function viewHardware() {
  if (!S.hardware) return loadingView(L('Hardware y salud', 'Hardware & health'), loadHardware);
  const h = S.hardware;
  const adv = hardwareAdvice(h);
  const healthBadge = (d) => d.salud === 'Healthy' ? `<span class="badge verde">${L('Sano', 'Healthy')}</span>` : `<span class="badge rojo">${L('Con problemas', 'Problems')}</span>`;
  return `<div class="view">${banners()}${head(L('Hardware y salud', 'Hardware & health'), L('Lo que tiene tu PC por dentro y cómo está.', "What's inside your PC and how it's doing."), `<button class="btn ghost" data-act="reloadHw">${L('Actualizar', 'Refresh')}</button>`)}
    ${progressHTML()}
    ${adv.length ? `<div class="card" style="margin-bottom:14px"><h3>${L('Consejos para tu PC', 'Tips for your PC')}</h3>${adv.map((a) => `<div class="advice"><span class="badge ${a.nivel === 'importante' ? 'rojo' : a.nivel === 'recomendado' ? 'amarillo' : 'gris'}">${a.nivel === 'importante' ? L('Importante', 'Important') : a.nivel === 'recomendado' ? L('Recomendado', 'Recommended') : L('Consejo', 'Tip')}</span><div>${esc(a.t)}</div></div>`).join('')}</div>`
      : `<div class="banner good"><div class="grow"><b>${L('Todo en orden', 'All good')}</b> · ${L('No vemos problemas en tu hardware.', 'No hardware problems found.')}</div></div>`}
    <div class="grid c3">
      <div class="card"><h3>${L('Sistema', 'System')}</h3><div class="big">${esc(h.sistema.nombre)}</div><div class="meta">${esc(h.sistema.version)} · build ${esc(h.sistema.build)}</div><div class="meta">${L('Encendido hace', 'Up for')} ${esc(h.sistema.diasEncendido)} ${L('días', 'days')}</div></div>
      <div class="card"><h3>${L('Procesador', 'Processor')}</h3><div class="big">${esc(h.cpu.nombre)}</div><div class="meta">${h.cpu.nucleos} ${L('núcleos', 'cores')} / ${h.cpu.hilos} ${L('hilos', 'threads')}${h.cpu.temp ? ' · ' + h.cpu.temp + ' °C' : ''}</div></div>
      <div class="card"><h3>${L('Memoria RAM', 'RAM')}</h3><div class="big">${fmtBytes(h.ram.total)}</div><div class="meta">${h.ram.modulos} ${L('módulo(s)', 'module(s)')}${h.ram.velocidad ? ' · ' + h.ram.velocidad + ' MT/s' : ''}</div>
        <div class="meter"><i style="width:${Math.round(100 * (1 - h.ram.libre / h.ram.total))}%"></i></div><div class="meta">${L('En uso ahora', 'In use now')}: ${fmtBytes(h.ram.total - h.ram.libre)}</div></div>
      ${(h.gpus || []).map((g) => `<div class="card"><h3>${L('Tarjeta gráfica', 'Graphics card')}</h3><div class="big">${esc(g.nombre)}</div><div class="meta">${g.vram ? fmtBytes(g.vram) + ' · ' : ''}${L('Driver', 'Driver')} ${esc(g.versionNvidia || g.driver)} (${esc(g.fechaDriver)})${g.temp ? ' · ' + g.temp + ' °C' : ''}</div></div>`).join('')}
      <div class="card"><h3>${L('Placa base', 'Motherboard')}</h3><div class="big">${esc(h.placa.modelo)}</div><div class="meta">${esc(h.placa.fabricante)}</div><div class="meta">BIOS ${esc(h.bios.version)} (${esc(h.bios.fecha)})</div></div>
      ${h.bateria ? `<div class="card"><h3>${L('Batería', 'Battery')}</h3><div class="big">${h.bateria.carga}%</div>${h.bateria.salud ? `<div class="meta">${L('Salud', 'Health')}: ${h.bateria.salud}%</div>` : ''}</div>` : ''}
    </div>
    <h2>${L('Discos', 'Disks')}</h2>
    <div class="grid c2">${(h.discos || []).map((d) => `<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div class="big">${esc(d.nombre)}</div>${healthBadge(d)}</div>
      <div class="meta">${esc(d.tipo || d.bus)} · ${fmtBytes(d.tamano)}${d.temperatura ? ' · ' + d.temperatura + ' °C' : ''}${d.horas ? ' · ' + Math.round(d.horas / 24) + L(' días encendido', ' days powered on') : ''}</div>
      ${d.desgaste != null ? `<div class="meter"><i class="${d.desgaste >= 80 ? 'rojo' : d.desgaste >= 50 ? 'amarillo' : ''}" style="width:${Math.max(2, d.desgaste)}%"></i></div><div class="meta">${L('Desgaste', 'Wear')}: ${d.desgaste}%</div>` : ''}
      ${d.errores ? `<div class="meta" style="color:var(--rojo)">${d.errores} ${L('errores de lectura/escritura', 'read/write errors')}</div>` : ''}</div>`).join('')}</div>
    <h2>${L('Espacio', 'Space')}</h2>
    <div class="grid c2">${(h.unidades || []).map((v) => { const used = v.total ? 1 - v.libre / v.total : 0; return `<div class="card"><div class="big">${esc(v.letra)} ${esc(v.etiqueta || '')}</div><div class="meter"><i class="${used > 0.9 ? 'rojo' : used > 0.8 ? 'amarillo' : ''}" style="width:${Math.round(used * 100)}%"></i></div><div class="meta">${fmtBytes(v.libre)} ${L('libres de', 'free of')} ${fmtBytes(v.total)}</div></div>`; }).join('')}</div></div>`;
}

function viewDrivers() {
  if (!S.drivers) return loadingView(L('Drivers', 'Drivers'), async () => { await loadDrivers(); if (!S.hardware) await loadHardware(); });
  const d = S.drivers;
  const prob = d.problemas.filter((p) => p.codigo !== 45);
  const imp = d.drivers.filter((x) => x.importante && !x.generico);
  const wuDrv = (S.updates?.windows || []).filter((u) => u.tipo === 'driver');
  const gpus = (S.hardware?.gpus || []).filter((g) => GPU_LINKS[g.fabricante]);
  imp.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  return `<div class="view">${banners()}${head(L('Drivers', 'Drivers'), L('Los drivers son los "traductores" entre Windows y tu hardware. RetroLimpia solo usa fuentes oficiales: Windows Update y las apps de cada fabricante. Nunca webs de "drivers gratis".', 'Drivers are the "translators" between Windows and your hardware. RetroLimpia only uses official sources: Windows Update and each manufacturer\'s app. Never "free driver" websites.'), `<button class="btn" data-act="backupDrivers" ${S.busy ? 'disabled' : ''}>${L('Hacer copia de mis drivers', 'Back up my drivers')}</button>`)}
    ${progressHTML()}
    ${prob.length ? `<div class="card" style="border-color:rgba(255,84,112,.5);margin-bottom:14px"><h3 style="color:var(--rojo)">${L('Dispositivos con problemas', 'Devices with problems')}</h3>
      ${prob.map((p) => `<div class="advice"><span class="badge rojo">${L('Código', 'Code')} ${p.codigo}</span><div><b>${esc(p.dispositivo)}</b><div class="meta">${L(...(PNP_CODES[p.codigo] || ['Tiene un problema.', 'Has a problem.']))} ${L('Prueba primero con las actualizaciones de Windows Update de abajo; si sigue, instala el driver desde la web del fabricante.', 'Try the Windows Update updates below first; if it persists, install the driver from the manufacturer website.')}</div>${S.settings.modoExperto ? `<div class="tech">${esc(p.id)}</div>` : ''}</div></div>`).join('')}</div>`
      : `<div class="banner good"><div class="grow"><b>${L('Todos tus dispositivos funcionan', 'All your devices are working')}</b></div></div>`}
    ${gpus.length ? `<h2>${L('Tu tarjeta gráfica', 'Your graphics card')}</h2><div class="grid c2">${gpus.map((g) => `<div class="card"><div class="big">${esc(g.nombre)}</div><div class="meta">${L('Driver actual', 'Current driver')}: ${esc(g.versionNvidia || g.driver)} (${esc(g.fechaDriver)})</div>
      <p class="meta">${L('Para gráficas, el driver más nuevo y fiable sale de la app oficial del fabricante. Windows Update suele ir varios meses atrás.', 'For graphics cards, the newest reliable driver comes from the official app. Windows Update is often months behind.')}</p>
      <button class="btn primary small" data-open="${GPU_LINKS[g.fabricante][1]}">${L('Abrir', 'Open')} ${GPU_LINKS[g.fabricante][0]}</button></div>`).join('')}</div>` : ''}
    <h2>${L('Drivers oficiales disponibles en Windows Update', 'Official drivers available on Windows Update')}${S.updates ? '' : `<span class="sub"><button class="link" data-act="loadUpdates">${L('Buscar ahora', 'Search now')}</button></span>`}</h2>
    ${S.updates ? (wuDrv.length ? `<div class="list">${wuDrv.map((u) => `<div class="row"><div class="grow"><div class="name">${esc(u.titulo)}</div><div class="sub">${fmtBytes(u.tamano)}${u.opcional ? ' · ' + L('opcional', 'optional') : ''}</div></div><button class="btn small" data-wu="${esc(u.id)}" ${S.busy ? 'disabled' : ''}>${L('Instalar', 'Install')}</button></div>`).join('')}</div>` : `<div class="card meta">${L('Windows Update no tiene drivers nuevos para ti.', 'Windows Update has no new drivers for you.')}</div>`) : ''}
    <h2>${L('Drivers importantes instalados', 'Important installed drivers')}<span class="sub">${L('ordenados del más antiguo al más nuevo', 'oldest first')}</span></h2>
    <div class="list">${imp.map((x) => { const y = yearsSince(x.fecha); return `<div class="row"><div class="grow"><div class="name">${esc(x.dispositivo)}</div><div class="sub">${esc(x.proveedor)} · ${esc(x.version)}</div>${S.settings.modoExperto ? `<div class="tech">${esc(x.inf)} · ${esc(x.clase)}</div>` : ''}</div>
      ${y != null && y > 3 ? `<span class="badge amarillo">${L('Antiguo', 'Old')}</span>` : `<span class="badge verde">OK</span>`}<div class="size">${esc(x.fecha)}</div></div>`; }).join('') || `<div class="empty">—</div>`}</div>
    ${d.respaldos.length ? `<p class="meta" style="margin-top:14px">${L('Copias de drivers guardadas', 'Saved driver backups')}: ${d.respaldos.length} · <button class="link" data-folder="drivers">${L('Abrir carpeta', 'Open folder')}</button></p>` : ''}</div>`;
}

function viewActualizaciones() {
  if (!S.updates) return loadingView(L('Actualizaciones', 'Updates'), loadUpdates, L('Preguntando a Windows Update. Puede tardar unos minutos...', 'Asking Windows Update. May take a few minutes...'));
  const u = S.updates;
  S.updSel = S.updSel || new Set();
  const wu = u.windows;
  const big = wu.filter((x) => x.grande);
  const normal = wu.filter((x) => !x.grande);
  const tipoTxt = { seguridad: L('Seguridad', 'Security'), driver: 'Driver', windows: 'Windows' };
  const keysWu = normal.map((x) => 'wu:' + x.id), keysWg = u.apps.map((a) => 'wg:' + a.id);
  const allOn = (keys) => keys.length && keys.every((k) => S.updSel.has(k));
  const selAll = (grp, keys) => keys.length ? `<button class="link sel-all" data-updall="${grp}">${allOn(keys) ? L('Quitar todos', 'Untick all') : L('Marcar todos', 'Tick all')}</button>` : '';
  const nSel = [...S.updSel].filter((k) => keysWu.includes(k) || keysWg.includes(k)).length;
  const chk = (key) => `<input type="checkbox" class="check" data-upd="${esc(key)}" ${S.updSel.has(key) ? 'checked' : ''} ${S.busy ? 'disabled' : ''}>`;
  return `<div class="view">${banners()}${head(L('Actualizaciones', 'Updates'), L('Marca lo que quieras actualizar y hazlo de una vez, o actualízalo todo. Solo fuentes oficiales: Windows Update y winget (el gestor de apps de Microsoft).', 'Tick what you want to update and do it in one go, or update everything. Official sources only: Windows Update and winget (Microsoft\'s app manager).'), `<button class="btn ghost" data-act="loadUpdates" ${S.busy ? 'disabled' : ''}>${L('Buscar de nuevo', 'Search again')}</button>`)}
    ${progressHTML()}
    ${u.error ? `<div class="banner warn"><div class="grow">${L('Windows Update no respondió', 'Windows Update did not respond')}: ${esc(u.error)}</div></div>` : ''}
    <h2>${L('Windows y drivers', 'Windows & drivers')}<span class="sub">${normal.length} ${L('disponibles', 'available')}</span>${selAll('wu', keysWu)}</h2>
    ${normal.length ? `<div class="list">${normal.map((x) => `<label class="row">${chk('wu:' + x.id)}<div class="grow"><div class="name">${esc(x.titulo)}</div><div class="sub">${tipoTxt[x.tipo]} · ${fmtBytes(x.tamano)}${x.reinicio ? ' · ' + L('pide reiniciar', 'needs restart') : ''}${x.opcional ? ' · ' + L('opcional', 'optional') : ''}</div></div>
      <span class="badge ${x.tipo === 'seguridad' ? 'rojo' : x.opcional ? 'gris' : 'amarillo'}">${x.tipo === 'seguridad' ? L('Importante', 'Important') : x.opcional ? L('Opcional', 'Optional') : L('Recomendado', 'Recommended')}</span>
      <button class="btn small" data-wu="${esc(x.id)}" ${S.busy ? 'disabled' : ''}>${L('Instalar', 'Install')}</button></label>`).join('')}</div>` : `<div class="banner good"><div class="grow"><b>${L('Windows está al día', 'Windows is up to date')}</b></div></div>`}
    ${big.length ? `<div class="banner info" style="margin-top:12px"><div class="grow"><b>${L('Hay una versión nueva de Windows disponible', 'A new Windows version is available')}</b> · ${esc(big[0].titulo)}. ${L('Por seguridad, RetroLimpia no la instala automáticamente: hazlo desde Configuración > Windows Update cuando tengas tiempo.', 'For safety RetroLimpia does not install it automatically: do it from Settings > Windows Update when you have time.')}</div></div>` : ''}
    <h2>${L('Tus programas', 'Your programs')}<span class="sub">${u.apps.length} ${L('con versión nueva', 'with a new version')}</span>${selAll('wg', keysWg)}</h2>
    ${!u.wingetDisponible ? `<div class="banner warn"><div class="grow">${L('Falta "Instalador de aplicaciones" (winget). Instálalo gratis desde Microsoft Store para poder actualizar tus programas.', 'App Installer (winget) is missing. Install it free from the Microsoft Store to update your programs.')}</div><button class="btn small" data-open="https://apps.microsoft.com/detail/9NBLGGH4NNS1">${L('Abrir Store', 'Open Store')}</button></div>`
      : u.apps.length ? `<div class="list">${u.apps.map((a) => `<label class="row">${chk('wg:' + a.id)}<div class="grow"><div class="name">${esc(a.nombre)}</div><div class="sub">${esc(a.actual)} → <b style="color:var(--verde)">${esc(a.nueva)}</b></div>${S.settings.modoExperto ? `<div class="tech">${esc(a.id)}</div>` : ''}</div><button class="btn small" data-wg="${esc(a.id)}" ${S.busy ? 'disabled' : ''}>${L('Actualizar', 'Update')}</button></label>`).join('')}</div>`
      : `<div class="banner good"><div class="grow"><b>${L('Tus programas están al día', 'Your programs are up to date')}</b></div></div>`}
    ${(normal.length || u.apps.length) ? `<div class="actionbar">
      ${nSel ? `<div class="info">${L(`<b>${nSel}</b> seleccionado(s). Se instalan uno detrás de otro, sin ventanas.`, `<b>${nSel}</b> selected. Installed one after another, no pop-ups.`)}</div>
        <button class="btn ghost" data-act="updNone">${L('Quitar selección', 'Clear')}</button>
        <button class="btn primary" data-act="updateSel" ${S.busy ? 'disabled' : ''}>${L('Actualizar seleccionados', 'Update selected')} (${nSel})</button>`
      : `<div class="info">${L('Marca las casillas para elegir qué actualizar. "Todo" no incluye opcionales de Windows ni cambios de versión.', 'Tick boxes to choose what to update. "All" excludes optional Windows updates and version upgrades.')}</div>
        <button class="btn primary" data-act="updateAll" ${S.busy ? 'disabled' : ''}>${L('Actualizar todo', 'Update all')}</button>`}</div>` : ''}</div>`;
}

// ============================================================ Procesos (avanzado)
async function loadProcs() {
  if (S.procLoading) return;
  S.procLoading = true;
  try {
    const r = obj(await rl.run('procesos', { accion: 'listar' }));
    S.procs = { procesos: arr(r.procesos).map((x) => ({ ...x, pids: arr(x.pids) })), ramTotal: r.ramTotal || 0, ramLibre: r.ramLibre || 0, cpuTotal: r.cpuTotal || 0, at: Date.now() };
  } catch (e) { if (!isCancel(e)) S.procError = String(e.message || e).slice(0, 200); }
  finally { S.procLoading = false; if (S.view === 'procesos') render(); }
}
setInterval(() => { if (S.view === 'procesos' && S.settings.procesosAviso && !S.procPaused && !S.procConfirm) loadProcs(); }, 3000);

function showProcWarning() {
  $('#modal').innerHTML = `<div class="modal warn-modal" role="dialog" aria-modal="true">
    <h2>⚠ ${L('Zona para usuarios avanzados', 'Advanced users only')}</h2>
    <p class="lead">${L('Aquí ves todo lo que está funcionando ahora en tu PC y puedes cerrarlo a la fuerza. <b>Úsalo solo si sabes lo que estás haciendo.</b>', 'Here you see everything running on your PC right now and can force it to close. <b>Only use it if you know what you are doing.</b>')}</p>
    <div class="why"><span class="n">1</span><div><b>${L('Puedes perder trabajo', 'You can lose work')}</b><p>${L('Cerrar un programa a la fuerza no guarda nada: si tenías un documento o una partida sin guardar, se pierde.', 'Force-closing a program saves nothing: unsaved documents or games are lost.')}</p></div></div>
    <div class="why"><span class="n">2</span><div><b>${L('Algunas cosas dejan de funcionar', 'Some things stop working')}</b><p>${L('El sonido, la red, el antivirus o la barra de tareas dependen de procesos que no reconocerías por el nombre.', 'Sound, network, antivirus or the taskbar depend on processes you would not recognise by name.')}</p></div></div>
    <div class="why"><span class="n">3</span><div><b>${L('Lo vital está protegido', 'Vital parts are protected')}</b><p>${L('Los procesos imprescindibles de Windows aparecen bloqueados y no se pueden cerrar desde aquí. Si no reconoces algo, déjalo como está.', 'Essential Windows processes are locked and cannot be closed here. If you do not recognise something, leave it alone.')}</p></div></div>
    <div class="foot"><button class="btn primary" data-act="procOk">${L('Entiendo, continuar', 'I understand, continue')}</button><button class="btn ghost" data-act="procBack">${L('Mejor no', 'Better not')}</button></div></div>`;
  $('#modal').classList.remove('hidden');
}

const PROC_LVL = {
  ram: (b) => (b >= 1.5 * GB ? ['rojo', 'Mucha', 'A lot'] : b >= 400 * 1024 ** 2 ? ['amarillo', 'Bastante', 'Quite a bit'] : ['verde', 'Poca', 'Little']),
  cpu: (c) => (c >= 25 ? ['rojo', 'Mucho', 'A lot'] : c >= 5 ? ['amarillo', 'Algo', 'Some'] : ['verde', 'Poco', 'Little'])
};
function procRow(x, maxRam) {
  const name = x.descripcion && x.descripcion.length < 60 ? x.descripcion : x.nombre;
  const [rc, res, ren] = PROC_LVL.ram(x.ram), [cc, ces, cen] = PROC_LVL.cpu(x.cpu);
  const heavy = !x.windows && (x.ram >= 1.5 * GB || x.cpu >= 25);
  const confirming = S.procConfirm === x.nombre;
  const hue = [...x.nombre].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
  let action;
  if (x.critico) action = `<span class="badge gris" title="${L('Windows lo necesita para funcionar', 'Windows needs it to work')}">🔒 ${L('Protegido', 'Protected')}</span>`;
  else if (x.windows && !S.settings.modoExperto) action = `<span class="badge gris" title="${L('Es parte de Windows. Actívalo en modo experto si de verdad necesitas cerrarlo.', 'Part of Windows. Enable expert mode if you really need to close it.')}">${L('Mejor no tocar', 'Better leave it')}</span>`;
  else if (confirming) action = `<button class="btn small danger" data-pkill="${esc(x.nombre)}">${L('Sí, cerrar', 'Yes, close')}</button><button class="btn small ghost" data-act="procNo">${L('No', 'No')}</button>`;
  else action = `<button class="btn small ghost" data-pask="${esc(x.nombre)}">${L('Cerrar', 'Close')}</button>`;
  return `<div class="row prow2 ${confirming ? 'confirming' : ''}">
    <span class="pavatar" style="--h:${hue}">${esc((name[0] || '?').toUpperCase())}</span>
    <div class="grow"><div class="name">${esc(name)}${x.cantidad > 1 ? ` <span class="meta" title="${L('Este programa funciona repartido en varias partes', 'This program runs split into several parts')}">· ${x.cantidad} ${L('partes', 'parts')}</span>` : ''}</div>
      <div class="sub">${x.titulo ? '🪟 ' + esc(x.titulo) : esc(x.empresa || x.nombre + '.exe')}</div>
      ${confirming ? `<div class="why-line">${L('¿Seguro? Se cerrará a la fuerza y se perderá lo que no hayas guardado.', 'Sure? It will be force-closed and anything unsaved will be lost.')}</div>` : heavy ? `<div class="why-line">💡 ${L('Está usando mucho. Si no lo necesitas ahora, cerrarlo liberará recursos.', 'It is using a lot. If you do not need it now, closing it frees resources.')}</div>` : ''}
      ${S.settings.modoExperto && x.ruta ? `<div class="tech">${esc(x.ruta)}</div>` : ''}</div>
    <div class="pmet"><small>${L('Memoria', 'Memory')}</small><b>${fmtBytes(x.ram)}</b><span class="lvl ${rc}">${L(res, ren)}</span></div>
    <div class="pmet"><small>${L('Procesador', 'CPU')}</small><b>${x.cpu.toFixed(1)}%</b><span class="lvl ${cc}">${L(ces, cen)}</span></div>
    <div class="pact">${action}</div></div>`;
}

function viewProcesos() {
  const intro = head(L('Procesos (avanzado)', 'Processes (advanced)'), L('Qué programas están gastando la memoria y el procesador de tu PC ahora mismo.', 'Which programs are using your PC\'s memory and processor right now.'),
    `<button class="btn ghost" data-act="procPause">${S.procPaused ? L('Reanudar', 'Resume') : L('Pausar', 'Pause')}</button>`);
  if (!S.settings.procesosAviso) {
    if ($('#modal').classList.contains('hidden')) setTimeout(showProcWarning, 0);
    return `<div class="view">${banners()}${intro}</div>`;
  }
  if (!S.procs) { loadProcs(); return `<div class="view">${banners()}${intro}<div class="progress-card"><div class="msg"><span><b>${L('Mirando qué está funcionando...', 'Looking at what is running...')}</b></span></div><div class="pbar indet"><i></i></div></div></div>`; }
  const pr = S.procs;
  S.procSort = S.procSort || 'ram';
  const q = (S.procSearch || '').toLowerCase().trim();
  const match = (x) => !q || [x.nombre, x.descripcion, x.titulo, x.empresa].join(' ').toLowerCase().includes(q);
  const small = (x) => x.ram < 30 * 1024 ** 2 && x.cpu < 0.5;
  const sorter = (a, b) => (S.procSort === 'cpu' ? b.cpu - a.cpu || b.ram - a.ram : b.ram - a.ram);
  const all = pr.procesos.filter(match).sort(sorter);
  const showSmall = S.procShowSmall || !!q;
  const groups = [
    ['usando', '🪟', L('Programas que estás usando', 'Programs you are using'), L('Tienen una ventana abierta.', 'They have an open window.'), all.filter((x) => x.ventana && !x.windows)],
    ['fondo', '⚙️', L('Funcionando en segundo plano', 'Running in the background'), L('Sin ventana: actualizadores, ayudantes de otros programas, launchers...', 'No window: updaters, helpers of other programs, launchers...'), all.filter((x) => !x.ventana && !x.windows)],
    ['windows', '🛡️', L('Partes de Windows', 'Parts of Windows'), L('Windows las necesita. Mejor no tocarlas.', 'Windows needs them. Better leave them alone.'), all.filter((x) => x.windows)]
  ];
  const ramUsada = pr.ramTotal - pr.ramLibre;
  const ramPct = pr.ramTotal ? Math.round(100 * ramUsada / pr.ramTotal) : 0;
  const mood = (pct) => (pct >= 90 ? ['rojo', 'Al límite', 'Maxed out'] : pct >= 70 ? ['amarillo', 'Ocupado', 'Busy'] : ['verde', 'Tranquilo', 'Relaxed']);
  const [mc, mes, men] = mood(ramPct), [pc, pes, pen] = mood(pr.cpuTotal);
  let hidden = 0;
  const sections = groups.map(([id, ico, title, desc, list]) => {
    const collapsed = id === 'windows' && !S.procShowWin && !q;
    const vis = showSmall ? list : list.filter((x) => !small(x));
    hidden += list.length - vis.length;
    if (!list.length) return '';
    return `<h2>${ico} ${title}<span class="sub">${list.length} · ${desc}</span>${id === 'windows' ? `<button class="link sel-all" data-act="procWin">${collapsed ? L('Mostrar', 'Show') : L('Ocultar', 'Hide')}</button>` : ''}</h2>
      ${collapsed ? '' : vis.length ? `<div class="list">${vis.map((x) => procRow(x)).join('')}</div>` : `<div class="card meta">${L('Solo hay procesos pequeños aquí.', 'Only small processes here.')}</div>`}`;
  }).join('');
  return `<div class="view">${banners()}${intro}
    <div class="banner info"><div class="grow">💡 ${L('<b>¿Tu PC va lento?</b> Aquí ves quién tiene la culpa. Cada programa abierto usa parte de la memoria y del procesador. Cerrar algo desde aquí es cerrarlo a la fuerza: <b>no guarda nada</b>.', '<b>PC feeling slow?</b> Here you see who is to blame. Every open program uses some memory and processor. Closing something here force-closes it: <b>nothing is saved</b>.')}</div></div>
    <div class="grid c2" style="margin-bottom:14px">
      <div class="card"><h3>${L('Memoria (RAM)', 'Memory (RAM)')}</h3><div class="big">${fmtBytes(ramUsada)} <span class="meta">${L('de', 'of')} ${fmtBytes(pr.ramTotal)}</span> <span class="lvl ${mc}">${L(mes, men)}</span></div><div class="meter"><i class="${mc === 'verde' ? '' : mc}" style="width:${ramPct}%"></i></div></div>
      <div class="card"><h3>${L('Procesador', 'Processor')}</h3><div class="big">${pr.cpuTotal}% <span class="lvl ${pc}">${L(pes, pen)}</span></div><div class="meter"><i class="${pc === 'verde' ? '' : pc}" style="width:${Math.max(1, pr.cpuTotal)}%"></i></div></div>
    </div>
    <div class="toolbar"><input class="search" id="procSearch" placeholder="${L('Buscar un programa (ej. chrome, discord, obs)...', 'Search a program (e.g. chrome, discord, obs)...')}" value="${esc(S.procSearch || '')}">
      <button class="chip ${S.procSort === 'ram' ? 'on' : ''}" data-psort="ram">${L('Más memoria', 'Most memory')}</button><button class="chip ${S.procSort === 'cpu' ? 'on' : ''}" data-psort="cpu">${L('Más procesador', 'Most CPU')}</button></div>
    ${q && !all.length ? `<div class="empty">${L('No hay nada funcionando con ese nombre.', 'Nothing running with that name.')}</div>` : sections}
    ${hidden ? `<p class="meta" style="margin-top:14px;text-align:center"><button class="link" data-act="procSmall">${L(`Mostrar también ${hidden} procesos pequeños`, `Also show ${hidden} small processes`)}</button></p>` : S.procShowSmall && !q ? `<p class="meta" style="margin-top:14px;text-align:center"><button class="link" data-act="procSmall">${L('Ocultar los procesos pequeños', 'Hide small processes')}</button></p>` : ''}
    ${S.procPaused ? `<p class="meta" style="text-align:center">${L('En pausa: los datos no se actualizan.', 'Paused: data is not refreshing.')}</p>` : ''}</div>`;
}

function viewDeshacer() {
  if (!S.quarantine) return loadingView(L('Deshacer y cuarentena', 'Undo & quarantine'), loadQuarantine);
  const dias = S.settings.diasCuarentena || 7;
  const lotes = S.quarantine.lotes || [];
  return `<div class="view">${banners()}${head(L('Deshacer y cuarentena', 'Undo & quarantine'), L(`Todo lo que RetroLimpia quita se guarda aquí ${dias} días antes de borrarse para siempre. Si algo deja de funcionar, restáuralo con un clic.`, `Everything RetroLimpia removes is kept here for ${dias} days before being deleted for good. If something breaks, restore it with one click.`))}
    ${progressHTML()}
    <h2>${L('Cuarentena', 'Quarantine')}</h2>
    <div class="list">${lotes.length ? lotes.map((l) => { const left = Math.max(0, Math.ceil(dias - (Date.now() - new Date(l.fecha)) / 864e5)); return `<div class="row"><div class="grow"><div class="name">${esc(l.motivo || L('Restos', 'Leftovers'))}</div><div class="sub">${new Date(l.fecha).toLocaleString()} · ${l.cantidad} ${L('elemento(s)', 'item(s)')} · ${fmtBytes(l.bytes)} · ${L(`se borra en ${left} día(s)`, `deleted in ${left} day(s)`)}</div></div><button class="btn small" data-restore="${esc(l.id)}" ${S.busy ? 'disabled' : ''}>${L('Restaurar', 'Restore')}</button></div>`; }).join('') : `<div class="empty">${L('La cuarentena está vacía.', 'Quarantine is empty.')}</div>`}</div>
    <h2>${L('Puntos de restauración de Windows', 'Windows restore points')}</h2>
    <div class="card"><p class="meta" style="margin-top:0">${L('Si algo grave sale mal (por ejemplo, tras actualizar un driver), Windows puede volver al estado de un punto de restauración. Tus documentos no se tocan.', 'If something serious goes wrong (e.g. after a driver update), Windows can go back to a restore point. Your documents are not touched.')}</p>
      ${(S.restorePoints?.puntos || []).slice(-5).reverse().map((p) => `<div class="advice"><span class="badge gris">${esc(p.fecha)}</span><div>${esc(p.descripcion)}</div></div>`).join('') || `<p class="meta">${L('No hay puntos guardados.', 'No restore points saved.')}</p>`}
      <button class="btn" data-act="openRestore" style="margin-top:10px">${L('Abrir Restaurar sistema', 'Open System Restore')}</button></div>
    <p class="meta" style="margin-top:16px"><button class="link" data-folder="cuarentena">${L('Abrir carpeta de cuarentena', 'Open quarantine folder')}</button> · <button class="link" data-folder="drivers">${L('Copias de drivers', 'Driver backups')}</button> · <button class="link" data-folder="logs">${L('Registro de cambios', 'Change log')}</button></p></div>`;
}

function updStatusText() {
  const up = S.upd || {};
  if (up.estado === 'lista') return L(`La versión ${up.version} está descargada y lista para instalar.`, `Version ${up.version} is downloaded and ready to install.`);
  if (up.estado === 'descargando') return L(`Descargando la versión ${up.version || ''}... ${up.pct || 0}%`, `Downloading version ${up.version || ''}... ${up.pct || 0}%`);
  if (up.estado === 'error') return L('No se pudo comprobar (¿sin internet?). Se volverá a intentar solo.', 'Could not check (offline?). It will retry by itself.');
  if (S.appUpdate && S.appUpdate.modo === 'manual') return S.appUpdate.disponible ? L(`Hay una versión nueva: ${S.appUpdate.version}.`, `New version available: ${S.appUpdate.version}.`) : L('Tienes la última versión.', 'You have the latest version.');
  if (up.estado === 'al-dia') return L('Tienes la última versión. RetroLimpia lo comprueba solo cada vez que se abre.', 'You have the latest version. RetroLimpia checks by itself every time it opens.');
  return L('RetroLimpia busca actualizaciones solo cada vez que se abre y las instala con un clic.', 'RetroLimpia checks for updates every time it opens and installs them with one click.');
}

function viewAjustes() {
  const s = S.settings;
  const sw = (key, title, desc) => `<div class="setting"><div class="grow"><b>${title}</b><span>${desc}</span></div><label class="switch"><input type="checkbox" data-setting="${key}" ${(key === 'notificaciones' ? s[key] !== false : s[key]) ? 'checked' : ''}><span></span></label></div>`;
  const repo = repoUrl();
  return `<div class="view">${banners()}${head(L('Ajustes', 'Settings'), L('Casi nadie necesita cambiar nada aquí.', 'Most people never need to change anything here.'))}
    <div class="card">
      <div class="setting"><div class="grow"><b>${L('Idioma', 'Language')}</b></div><select data-setting="idioma"><option value="es" ${s.idioma === 'es' ? 'selected' : ''}>Español</option><option value="en" ${s.idioma === 'en' ? 'selected' : ''}>English</option></select></div>
      <div class="setting"><div class="grow"><b>${L('Iniciar con Windows y avisarme', 'Start with Windows and remind me')}</b><span>${L('Revisa en silencio cada cierto tiempo y te manda una notificación si hay basura o actualizaciones. Recomendado.', 'Quietly checks every so often and notifies you about junk or updates. Recommended.')}</span></div><label class="switch"><input type="checkbox" data-autostart ${s.inicioWindows ? 'checked' : ''}><span></span></label></div>
      ${s.inicioWindows ? `<div class="setting"><div class="grow"><b>${L('Frecuencia de revisión', 'Check frequency')}</b><span>${s.ultimaRevision ? L('Última revisión: ', 'Last check: ') + new Date(s.ultimaRevision).toLocaleString() : L('Todavía no ha revisado.', 'No check yet.')}</span></div>${freqSelect('data-setting="frecuenciaDias"')} <button class="btn small ghost" data-act="checkNow">${L('Revisar ahora', 'Check now')}</button></div>` : ''}
      ${s.inicioWindows ? sw('notificaciones', L('Notificaciones', 'Notifications'), L('Si las desactivas, RetroLimpia sigue revisando en silencio: verás el resumen pasando el ratón por su icono junto al reloj, o aquí al abrirlo.', 'If you turn them off, RetroLimpia keeps checking quietly: hover its icon next to the clock or open it here to see the summary.')) + (s.ultimoResumen ? `<div class="setting"><div class="grow"><b>${L('Última revisión automática', 'Last automatic check')}</b><span>${esc(s.ultimoResumen)}</span></div></div>` : '') : ''}
      ${sw('restosAutomaticos', L('Borrar restos seguros automáticamente', 'Remove safe leftovers automatically'), L('Al desinstalar, mueve a la cuarentena los restos que seguro son del programa, sin preguntar.', 'After uninstalling, quarantine leftovers that surely belong to the program without asking.'))}
      ${sw('puntoRestauracion', L('Crear punto de restauración antes de cambios', 'Create a restore point before changes'), L('Muy recomendado. Tarda unos segundos.', 'Highly recommended. Takes a few seconds.'))}
      <div class="setting"><div class="grow"><b>${L('Días en cuarentena', 'Days in quarantine')}</b><span>${L('Cuánto tiempo se guardan las cosas quitadas antes de borrarlas.', 'How long removed items are kept before deletion.')}</span></div><select data-setting="diasCuarentena">${[3, 7, 14, 30].map((d) => `<option value="${d}" ${s.diasCuarentena == d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      ${sw('modoExperto', L('Modo experto', 'Expert mode'), L('Muestra detalles técnicos y permite quitar elementos marcados en rojo. Solo si sabes lo que haces.', 'Shows technical details and allows removing red items. Only if you know what you are doing.'))}
    </div>
    <h2>${L('Acerca de RetroLimpia', 'About RetroLimpia')}</h2>
    <div class="card"><div class="kv"><span>${L('Versión', 'Version')}</span><span>${esc(S.info.version)}</span><span>${L('Licencia', 'License')}</span><span>MIT (${L('código abierto', 'open source')})</span><span>${L('Privacidad', 'Privacy')}</span><span>${L('No envía ningún dato tuyo a internet.', 'Sends none of your data to the internet.')}</span></div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn" data-act="trust">${L('¿Por qué Windows o mi antivirus avisan?', 'Why does Windows or my antivirus warn me?')}</button>
      ${repo ? `<button class="btn ghost" data-open="${repo}">${L('Ver el código', 'View the code')}</button>` : ''}
      <button class="btn ghost" data-act="checkUpdate" ${S.checkingUpd ? 'disabled' : ''}>${S.checkingUpd ? L('Buscando...', 'Checking...') : L('Buscar actualizaciones', 'Check for updates')}</button></div>
      <p class="meta" style="margin-top:12px">${updStatusText()}</p></div></div>`;
}

function loadingView(title, loader, msg) {
  S.failed = S.failed || {};
  if (S.failed[title]) {
    return `<div class="view">${banners()}${head(title, '')}<div class="banner bad"><div class="grow"><b>${L('No se pudo leer esta información', 'Could not read this information')}</b> · ${esc(S.failed[title])}</div><button class="btn small" data-retry="${esc(title)}">${L('Reintentar', 'Retry')}</button></div></div>`;
  }
  if (!S.busy) setTimeout(() => task(L('Cargando', 'Loading') + ' · ' + title, async () => {
    try { await loader(); } catch (e) { S.failed[title] = String(e.message || e).slice(0, 300); throw e; }
  }), 0);
  return `<div class="view">${banners()}${head(title, msg || L('Un momento...', 'One moment...'))}${progressHTML()}</div>`;
}

// ============================================================ Confianza
function showTrust() {
  const repo = repoUrl();
  $('#modal').innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <h2>${L('Tranquilo: RetroLimpia no es un virus', "Relax: RetroLimpia isn't a virus")}</h2>
    <p class="lead">${L('Puede que Windows te haya mostrado una pantalla azul de "Windows protegió su PC" o que tu antivirus haya dudado. Te explicamos por qué pasa, con total sinceridad:', 'Windows may have shown a blue "Windows protected your PC" screen, or your antivirus may have hesitated. Here is honestly why:')}</p>
    <div class="why"><span class="n">1</span><div><b>${L('No tiene firma digital de pago', "It has no paid digital signature")}</b><p>${L('Las grandes empresas pagan cada año un certificado para "firmar" sus programas. RetroLimpia es un proyecto independiente y gratuito, sin ese certificado. Windows avisa de cualquier programa nuevo sin firma, aunque no tenga nada malo: el aviso significa "no conozco a este autor", no "he encontrado un virus".', 'Big companies pay every year for a certificate to "sign" their software. RetroLimpia is an independent free project without one. Windows warns about any new unsigned program even if it is harmless: the warning means "I don\'t know this author", not "I found a virus".')}</p></div></div>
    <div class="why"><span class="n">2</span><div><b>${L('Hace cosas "poderosas" a propósito', 'It does "powerful" things on purpose')}</b><p>${L('Para limpiar de verdad, RetroLimpia necesita permisos de administrador, borrar archivos, tocar el registro y manejar drivers. Los antivirus usan reglas automáticas, y esas acciones también las hacen los programas malos. Por eso a veces dan una "falsa alarma" con limpiadores y desinstaladores.', 'To clean properly, RetroLimpia needs admin rights, deletes files, edits the registry and handles drivers. Antivirus use automatic rules, and malware does those things too. That\'s why cleaners and uninstallers sometimes get a "false alarm".')}</p></div></div>
    <div class="why"><span class="n">3</span><div><b>${L('Puedes comprobarlo tú mismo', 'You can check it yourself')}</b><p>${L('Su código es abierto: cualquiera puede leerlo en GitHub. Puedes subir el instalador a VirusTotal, que lo revisa con más de 60 antivirus a la vez. Y RetroLimpia no envía ningún dato tuyo a internet.', 'Its code is open: anyone can read it on GitHub. You can upload the installer to VirusTotal, which scans it with 60+ antivirus engines. And RetroLimpia sends none of your data to the internet.')}</p></div></div>
    <div class="why"><span class="n">4</span><div><b>${L('Y todo se puede deshacer', 'And everything can be undone')}</b><p>${L('Antes de cambiar nada crea un punto de restauración, y lo que quita pasa unos días en la cuarentena antes de borrarse.', 'Before changing anything it creates a restore point, and anything it removes spends a few days in quarantine before deletion.')}</p></div></div>
    <div class="foot"><button class="btn primary" data-act="trustOk">${L('Entendido, empezar', 'Got it, let\'s start')}</button>
      ${repo ? `<button class="btn ghost" data-open="${repo}">${L('Ver el código', 'View the code')}</button>` : ''}
      <button class="btn ghost" data-open="https://www.virustotal.com/">VirusTotal</button></div></div>`;
  $('#modal').classList.remove('hidden');
}

function freqSelect(attr) {
  return `<select ${attr}>${[[1, 'Cada día', 'Every day'], [3, 'Cada 3 días', 'Every 3 days'], [7, 'Cada semana', 'Every week'], [14, 'Cada 2 semanas', 'Every 2 weeks']].map(([d, es, en]) => `<option value="${d}" ${Number(S.settings.frecuenciaDias) === d ? 'selected' : ''}>${L(es, en)}</option>`).join('')}</select>`;
}
function showReminders() {
  $('#modal').innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <h2>${L('¿Te aviso cuando tu PC lo necesite?', 'Shall I remind you when your PC needs it?')}</h2>
    <p class="lead">${L('RetroLimpia puede arrancar en silencio con Windows y revisar cada pocos días si hay basura acumulada o actualizaciones pendientes. <b>Solo te avisa cuando de verdad hay algo que hacer</b>, y nunca cambia nada sin que tú lo confirmes.', 'RetroLimpia can start quietly with Windows and check every few days for piled-up junk or pending updates. <b>It only notifies you when there is actually something to do</b>, and never changes anything without your OK.')}</p>
    <div class="why"><span class="n">🛡</span><div><b>${L('Más seguro', 'Safer')}</b><p>${L('Las actualizaciones de seguridad cierran los agujeros que usan los virus. Cuanto antes se instalen, mejor.', 'Security updates close the holes viruses use. The sooner they are installed, the better.')}</p></div></div>
    <div class="why"><span class="n">⚡</span><div><b>${L('Más rápido', 'Faster')}</b><p>${L('La basura se acumula sola, varios GB al mes. Un repaso de vez en cuando mantiene el PC ágil.', 'Junk piles up by itself, several GB a month. A regular tune-up keeps the PC snappy.')}</p></div></div>
    <div class="why"><span class="n">🧠</span><div><b>${L('Sin tener que acordarte', 'Without remembering')}</b><p>${L('Casi nadie se acuerda de revisar su PC. RetroLimpia se acuerda por ti y apenas usa recursos mientras espera.', 'Hardly anyone remembers to check their PC. RetroLimpia remembers for you and barely uses resources while waiting.')}</p></div></div>
    <div class="setting" style="border:0;padding-bottom:0"><div class="grow"><b>${L('¿Cada cuánto reviso?', 'How often should I check?')}</b></div>${freqSelect('id="remFreq"')}</div>
    <div class="foot"><button class="btn primary" data-act="remindYes">${L('Sí, avísame (recomendado)', 'Yes, remind me (recommended)')}</button>
      <button class="btn ghost" data-act="remindNo">${L('Ahora no', 'Not now')}</button>
      <span class="meta">${L('Puedes cambiarlo cuando quieras en Ajustes.', 'You can change it any time in Settings.')}</span></div></div>`;
  $('#modal').classList.remove('hidden');
}

function showDonate() {
  $('#modal').innerHTML = `<div class="modal donate-modal" role="dialog" aria-modal="true">
    <div class="heart-anim" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg><span></span><span></span><span></span></div>
    <h2>${L('¡Gracias de corazón!', 'Thank you from the heart!')}</h2>
    <p class="lead">${L('Cualquier monto que envíes se agradece muchísimo. Gracias a gente como tú, RetroLimpia sigue siendo gratis, sin anuncios y mejorando cada día.', 'Any amount you send is deeply appreciated. Thanks to people like you, RetroLimpia stays free, ad-free and keeps improving.')}</p>
    <div class="why"><span class="n">💜</span><div><b>${L('Tú eliges el monto', 'You choose the amount')}</b><p>${L('Te llevaremos a un enlace de donación donde podrás poner la cantidad que quieras y, si te apetece, un mensaje.', 'We will take you to a donation link where you can enter any amount you like and, if you want, a message.')}</p></div></div>
    <div class="why"><span class="n">🔒</span><div><b>${L('Pago seguro a través de PayPal', 'Secure payment through PayPal')}</b><p>${L('El pago lo procesa PayPal de forma segura. RetroLimpia no ve ni guarda ningún dato personal tuyo: ni tu nombre, ni tu correo, ni tu tarjeta.', 'PayPal processes the payment securely. RetroLimpia never sees or stores any of your personal data: not your name, email or card.')}</p></div></div>
    <div class="banner good" style="margin-top:14px"><div class="grow">😊 <b>${L('Puedes estar tranquilo.', 'You can relax.')}</b> ${L('Se abrirá en tu navegador y puedes cerrarlo cuando quieras.', 'It opens in your browser and you can close it whenever you like.')}</div></div>
    <div class="foot"><button class="btn primary" data-act="donateGo">💜 ${L('Ir a donar', 'Go to donate')}</button><button class="btn ghost" data-act="modalClose">${L('Ahora no', 'Not now')}</button></div></div>`;
  $('#modal').classList.remove('hidden');
}

// ============================================================ Informe
function buildReport() {
  const h = S.hardware;
  const rows = (S.scan.findings || []).map((f) => `<li><b>[${f.nivel}]</b> ${esc(f.titulo)}${f.detalle ? ' — ' + esc(f.detalle) : ''}</li>`).join('');
  return `<!DOCTYPE html><html lang="${S.settings.idioma}"><head><meta charset="utf-8"><title>RetroLimpia - ${L('Informe', 'Report')}</title>
  <style>body{font:15px/1.6 Segoe UI,sans-serif;max-width:860px;margin:40px auto;padding:0 20px;color:#1a1631}h1{color:#8a5cff}td{padding:4px 14px 4px 0;vertical-align:top}.score{font-size:42px;font-weight:700}</style></head><body>
  <h1>RetroLimpia — ${L('Informe del PC', 'PC report')}</h1><p>${new Date().toLocaleString()} · ${esc(S.info.equipo || '')}</p>
  <p class="score">${S.scan.score ?? '—'}/100 <small>${S.scan.score != null ? scoreLabel(S.scan.score) : ''}</small></p>
  <h2>${L('Hallazgos', 'Findings')}</h2><ul>${rows || '<li>—</li>'}</ul>
  ${h ? `<h2>Hardware</h2><table>
   <tr><td>${L('Sistema', 'System')}</td><td>${esc(h.sistema.nombre)} ${esc(h.sistema.version)} (build ${esc(h.sistema.build)})</td></tr>
   <tr><td>CPU</td><td>${esc(h.cpu.nombre)}</td></tr><tr><td>RAM</td><td>${fmtBytes(h.ram.total)}</td></tr>
   <tr><td>GPU</td><td>${(h.gpus || []).map((g) => esc(g.nombre) + ' (driver ' + esc(g.driver) + ')').join('<br>')}</td></tr>
   <tr><td>${L('Placa', 'Board')}</td><td>${esc(h.placa.fabricante)} ${esc(h.placa.modelo)} · BIOS ${esc(h.bios.version)} (${esc(h.bios.fecha)})</td></tr>
   <tr><td>${L('Discos', 'Disks')}</td><td>${(h.discos || []).map((d) => esc(d.nombre) + ' — ' + esc(d.salud) + (d.desgaste != null ? ', ' + L('desgaste', 'wear') + ' ' + d.desgaste + '%' : '')).join('<br>')}</td></tr></table>` : ''}
  <p style="color:#888;margin-top:40px">${L('Generado por RetroLimpia', 'Generated by RetroLimpia')} ${esc(S.info.version)}</p></body></html>`;
}

// ============================================================ Render y eventos
function render() {
  renderNav();
  const views = { inicio: viewInicio, programas: viewProgramas, limpieza: viewLimpieza, arranque: viewArranque, hardware: viewHardware, drivers: viewDrivers, actualizaciones: viewActualizaciones, procesos: viewProcesos, deshacer: viewDeshacer, ajustes: viewAjustes };
  const focusId = document.activeElement && ['search', 'procSearch'].includes(document.activeElement.id) ? document.activeElement.id : null;
  const caret = focusId ? document.activeElement.selectionStart : 0;
  let html;
  try { html = (views[S.view] || viewInicio)(); }
  catch (e) {
    console.error(e);
    html = `<div class="view"><div class="banner bad"><div class="grow"><b>${L('Esta pantalla tuvo un problema', 'This screen had a problem')}</b> · ${esc(e.message)}</div><button class="btn small" data-nav="inicio">${L('Volver al inicio', 'Back to start')}</button></div></div>`;
  }
  $('#main').innerHTML = html;
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); el.setSelectionRange(caret, caret); } }
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-psort],[data-pask],[data-pkill],[data-updall],[data-retry],[data-nav],[data-act],[data-win],[data-open],[data-filter],[data-folder],[data-restore],[data-wu],[data-wg]');
  if (!t) return;
  if (t.dataset.psort) { S.procSort = t.dataset.psort; return render(); }
  if (t.dataset.pask) { S.procConfirm = t.dataset.pask; return render(); }
  if (t.dataset.pkill) {
    const g = S.procs.procesos.find((x) => x.nombre === t.dataset.pkill);
    S.procConfirm = null;
    if (!g) return render();
    const r = obj(await rl.run('procesos', { accion: 'terminar', nombre: g.nombre, pids: g.pids }));
    toast(r.ok ? L(`${g.nombre} cerrado.`, `${g.nombre} closed.`) : L(`No se pudo cerrar ${g.nombre} (puede necesitar más permisos o ser protegido).`, `Could not close ${g.nombre}.`), r.ok ? 'ok' : 'err');
    return loadProcs();
  }
  if (t.dataset.updall) { const keys = t.dataset.updall === 'wu' ? S.updates.windows.filter((x) => !x.grande).map((x) => 'wu:' + x.id) : S.updates.apps.map((a) => 'wg:' + a.id); const on = !keys.every((k) => S.updSel.has(k)); keys.forEach((k) => (on ? S.updSel.add(k) : S.updSel.delete(k))); return render(); }
  if (t.dataset.retry) { delete S.failed[t.dataset.retry]; return render(); }
  if (t.dataset.win) return rl.win(t.dataset.win);
  if (t.dataset.open) return rl.open(t.dataset.open);
  if (t.dataset.folder) return rl.openFolder(t.dataset.folder);
  if (t.dataset.nav) { S.view = t.dataset.nav; render(); $('#main').scrollTop = 0; return; }
  if (t.dataset.filter) { S.progFilter = t.dataset.filter; return render(); }
  if (t.dataset.restore) {
    return taskC(L('Restaurando', 'Restoring'), async () => {
      const r = await rl.run('cuarentena', { accion: 'restaurar', id: t.dataset.restore });
      toast(r.ok ? L('Restaurado. Todo volvió a su sitio.', 'Restored. Everything is back in place.') : L('Se restauró una parte; algunos archivos estaban en uso.', 'Partly restored; some files were in use.'), r.ok ? 'ok' : 'err');
      await loadQuarantine();
    });
  }
  if (t.dataset.wu) {
    return taskC(L('Instalando actualización', 'Installing update'), async () => {
      await restorePoint(L('Antes de actualizar', 'Before updating'));
      const r = await rl.run('actualizaciones', { accion: 'instalarWU', ids: [t.dataset.wu] });
      const ok = r.resultados.every((x) => x.ok);
      if (r.reinicio) S.needsReboot = true;
      toast(ok ? L('Actualización instalada.', 'Update installed.') : L('No se pudo instalar.', 'Could not install.'), ok ? 'ok' : 'err');
      S.updates.windows = S.updates.windows.filter((u) => !(ok && u.id === t.dataset.wu));
    });
  }
  if (t.dataset.wg) {
    return taskC(L('Actualizando programa', 'Updating program'), async () => {
      const r = await rl.run('actualizaciones', { accion: 'winget', ids: [t.dataset.wg] });
      const ok = r.resultados.every((x) => x.ok);
      toast(ok ? L('Programa actualizado.', 'Program updated.') : L('No se pudo actualizar (quizá está abierto).', 'Could not update (it may be open).'), ok ? 'ok' : 'err');
      if (ok) S.updates.apps = S.updates.apps.filter((a) => a.id !== t.dataset.wg);
    });
  }
  switch (t.dataset.act) {
    case 'cancel': return cancelTask();
    case 'procOk': S.settings = await rl.setSettings({ procesosAviso: true }); $('#modal').classList.add('hidden'); return render();
    case 'procBack': $('#modal').classList.add('hidden'); S.view = 'inicio'; return render();
    case 'procPause': S.procPaused = !S.procPaused; return render();
    case 'donateAsk': return showDonate();
    case 'donateGo': $('#modal').classList.add('hidden'); return rl.open(S.info.paypal);
    case 'modalClose': $('#modal').classList.add('hidden'); return;
    case 'procWin': S.procShowWin = !S.procShowWin; return render();
    case 'procSmall': S.procShowSmall = !S.procShowSmall; return render();
    case 'procNo': S.procConfirm = null; return render();
    case 'updNone': S.updSel.clear(); return render();
    case 'updateSel': return updateSelected();
    case 'scan': return scanAll();
    case 'fixAll': return fixAll();
    case 'closeFix': S.fix = null; return render();
    case 'report': { const f = await rl.saveReport(buildReport()); toast(L('Informe guardado en Documentos\\RetroLimpia', 'Report saved to Documents\\RetroLimpia')); return f; }
    case 'selVerde': allPrograms().filter((p) => p.cls.color === 'verde').forEach((p) => S.sel.add(p.id)); return render();
    case 'selNone': S.sel.clear(); return render();
    case 'uninstallSel': {
      const list = allPrograms().filter((p) => S.sel.has(p.id));
      return taskC(L('Desinstalando', 'Uninstalling'), async () => {
        const r = await uninstallPrograms(list, L('Desinstalar programas', 'Uninstall programs'));
        S.sel.clear();
        if (r.dudosos.length) S.pendingResidues = r.dudosos;
        toast(L(`${r.ok} programa(s) quitados`, `${r.ok} program(s) removed`) + (r.restosMovidos ? L(` y ${r.restosMovidos} resto(s) a la cuarentena (${fmtBytes(r.bytes)})`, ` and ${r.restosMovidos} leftover(s) quarantined (${fmtBytes(r.bytes)})`) : '') + '.');
        if (r.fail.length) toast(L('No se pudieron quitar: ', 'Could not remove: ') + r.fail.join(', '), 'err');
        await loadPrograms(); S.quarantine = null;
      });
    }
    case 'moveResidues': {
      const items = S.pendingResidues.flatMap((g) => g.restos.filter((r) => r.elegido));
      if (!items.length) { S.pendingResidues = null; return render(); }
      return taskC(L('Moviendo restos', 'Moving leftovers'), async () => {
        const q = await rl.run('cuarentena', { accion: 'mover', items, motivo: L('Restos revisados', 'Reviewed leftovers') });
        toast(L(`${q.guardados} resto(s) en la cuarentena.`, `${q.guardados} leftover(s) quarantined.`));
        S.pendingResidues = null; S.quarantine = null;
      });
    }
    case 'skipResidues': S.pendingResidues = null; return render();
    case 'clean':
      return taskC(L('Limpiando', 'Cleaning'), async () => {
        const r = await rl.run('limpieza', { accion: 'limpiar', categorias: [...S.junkSel] });
        toast(L('¡Liberaste ', 'You freed ') + fmtBytes(r.liberado) + '!');
        await loadJunk();
      });
    case 'reloadJunk': S.junk = null; return render();
    case 'reloadHw': S.hardware = null; return render();
    case 'loadUpdates': return task(L('Buscando actualizaciones', 'Searching updates'), loadUpdates);
    case 'startupRec':
      return taskC(L('Aplicando', 'Applying'), async () => {
        for (const it of S.startup.elementos.filter((i) => i.activo && classifyStartup(i).rec === 'desactivar')) await rl.run('inicio', { accion: 'cambiar', id: it.id, activar: false });
        await loadStartup(); toast(L('Listo. El próximo arranque será más rápido.', 'Done. Next startup will be faster.'));
      });
    case 'updateAll':
      return taskC(L('Actualizando todo', 'Updating everything'), async () => {
        await restorePoint(L('Antes de actualizar todo', 'Before updating everything'));
        if (S.updates.windows.some((u) => !u.grande)) {
          S.busy.label = 'Windows Update';
          const r = await rl.run('actualizaciones', { accion: 'instalarWU', todos: true });
          if (r.reinicio) S.needsReboot = true;
        }
        if (S.updates.apps.length) { S.busy.label = L('Programas', 'Programs'); await rl.run('actualizaciones', { accion: 'winget', todos: true }); }
        toast(L('Todo actualizado.', 'Everything updated.'));
        await loadUpdates();
      });
    case 'backupDrivers':
      return taskC(L('Copia de drivers', 'Driver backup'), async () => {
        const r = await rl.run('drivers', { accion: 'respaldar' });
        toast(r.ok ? L('Copia guardada (', 'Backup saved (') + fmtBytes(r.tamano) + ').' : L('No se pudo hacer la copia.', 'Backup failed.'), r.ok ? 'ok' : 'err');
        await loadDrivers();
      });
    case 'openRestore': return rl.run('restauracion', { accion: 'abrir' });
    case 'trust': return showTrust();
    case 'trustOk': $('#modal').classList.add('hidden'); S.settings = await rl.setSettings({ confianzaVista: true }); if (!S.settings.recordatoriosPreguntado) showReminders(); return;
    case 'remindYes': {
      const dias = Number(($('#remFreq') || {}).value) || 3;
      const r = await rl.autostart(true, dias); S.settings = r.settings; $('#modal').classList.add('hidden');
      toast(r.ok ? L('¡Hecho! Te avisaré cuando tu PC necesite un repaso.', "Done! I'll let you know when your PC needs a tune-up.") : L('No se pudo activar el inicio con Windows.', 'Could not enable start with Windows.'), r.ok ? 'ok' : 'err');
      return render();
    }
    case 'remindNo': S.settings = await rl.setSettings({ recordatoriosPreguntado: true }); $('#modal').classList.add('hidden'); return;
    case 'checkNow': {
      toast(L('Revisando... tarda unos segundos.', 'Checking... takes a few seconds.'));
      const res = await rl.checkNow();
      S.settings = await rl.getSettings();
      if (res) toast(L('Resultado: ', 'Result: ') + res);
      return render();
    }
    case 'checkUpdate': {
      S.checkingUpd = true; render();
      const r = await rl.checkUpdate().catch(() => ({ disponible: false, error: 'x' }));
      S.checkingUpd = false; S.appUpdate = r;
      if (r.error) toast(L('No se pudo comprobar. ¿Hay conexión a internet?', 'Could not check. Are you online?'), 'err');
      else if (!r.disponible) toast(L('Tienes la última versión. ✔', 'You have the latest version. ✔'));
      else toast(r.modo === 'auto' ? L(`Versión ${r.version} encontrada: se está descargando sola.`, `Version ${r.version} found: downloading by itself.`) : L(`Hay una versión nueva: ${r.version}.`, `New version: ${r.version}.`));
      return render();
    }
    case 'installUpdate': toast(L('Actualizando... RetroLimpia se volverá a abrir en unos segundos.', 'Updating... RetroLimpia will reopen in a few seconds.')); return rl.installUpdate();
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.sort !== undefined) { S.progSort = t.value; return render(); }
  if (t.dataset.upd) { t.checked ? S.updSel.add(t.dataset.upd) : S.updSel.delete(t.dataset.upd); return render(); }
  if (t.dataset.sel) { t.checked ? S.sel.add(t.dataset.sel) : S.sel.delete(t.dataset.sel); return render(); }
  if (t.dataset.junk) { t.checked ? S.junkSel.add(t.dataset.junk) : S.junkSel.delete(t.dataset.junk); return render(); }
  if (t.dataset.finding) { const f = S.scan.findings.find((x) => x.id === t.dataset.finding); if (f) f.elegido = t.checked; return render(); }
  if (t.dataset.res) { const [g, r] = t.dataset.res.split(':').map(Number); S.pendingResidues[g].restos[r].elegido = t.checked; return; }
  if (t.dataset.startup) {
    const id = t.dataset.startup, on = t.checked;
    return taskC(on ? L('Activando', 'Enabling') : L('Desactivando', 'Disabling'), async () => { await rl.run('inicio', { accion: 'cambiar', id, activar: on }); await loadStartup(); });
  }
  if (t.dataset.autostart !== undefined) {
    const r = await rl.autostart(t.checked, S.settings.frecuenciaDias); S.settings = r.settings;
    toast(t.checked ? (r.ok ? L('RetroLimpia arrancará con Windows y te avisará.', 'RetroLimpia will start with Windows and remind you.') : L('No se pudo activar.', 'Could not enable.')) : L('Ya no arrancará con Windows.', 'It will no longer start with Windows.'), r.ok ? 'ok' : 'err');
    return render();
  }
  if (t.dataset.setting) {
    const k = t.dataset.setting;
    const v = t.type === 'checkbox' ? t.checked : (['diasCuarentena', 'frecuenciaDias'].includes(k) ? Number(t.value) : t.value);
    S.settings = await rl.setSettings({ [k]: v });
    if (k === 'idioma') document.documentElement.lang = v;
    render();
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'search') { S.search = e.target.value; render(); }
  if (e.target.id === 'procSearch') { S.procSearch = e.target.value; render(); }
});

rl.onProgress((p) => {
  if (!S.busy) return;
  const msg = S.settings.idioma === 'en' ? p.en : p.msg;
  if (S.scan.state === 'running') {
    S.scan.pct[p.script] = p.pct;
    S.busy.pct = scanPct();
    if (p.pct < 100) S.busy.msg = msg;
  } else if (!S.cancelRequested) {
    S.busy.pct = p.pct; S.busy.msg = msg;
  }
  updateProgressOnly();
});
// El tiempo restante se recalcula cada segundo aunque el motor no informe.
setInterval(() => { if (S.busy) updateProgressOnly(); }, 1000);

// ============================================================ Arranque
(async function init() {
  [S.settings, S.info] = await Promise.all([rl.getSettings(), rl.info()]);
  const [bloat, prot, inicio] = await Promise.all([rl.data('bloatware'), rl.data('protegidos'), rl.data('inicio')]);
  S.data = { bloat, prot, inicio };
  document.documentElement.lang = S.settings.idioma;
  $('#ver').textContent = 'v' + S.info.version;
  render();
  if (!S.settings.confianzaVista) showTrust();
  else if (!S.settings.recordatoriosPreguntado) showReminders();
  rl.onUpdate((st) => { S.upd = st; render(); });
  rl.onSettings((st) => { S.settings = st; render(); });
  rl.onResumen(async () => { S.settings = await rl.getSettings(); render(); });
  rl.updateState().then((st) => {
    S.upd = st;
    // La versión portable no se actualiza sola: solo avisamos
    if (!st.auto) rl.checkUpdate().then((u) => { S.appUpdate = u; if (u.disponible) render(); }).catch(() => {});
    render();
  }).catch(() => {});
})();
